import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication failed", details: userErr?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { prompt, settings } = body;

    if (!prompt || prompt.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deduct 10 Mind Chips for image generation
    const COST = 10;
    const { data: newBalance, error: deductErr } = await userClient.rpc("deduct_mind_chips", {
      p_amount: COST,
      p_description: "Image Generation",
      p_generation_type: "image",
    });
    if (deductErr) {
      const msg = deductErr.message || "Deduction failed";
      if (msg.includes("INSUFFICIENT_BALANCE")) {
        return new Response(
          JSON.stringify({ success: false, error: "Not enough Mind Chips", details: msg.replace("INSUFFICIENT_BALANCE: ", "") }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to deduct Mind Chips", details: msg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cloudflare FLUX 1 Schnell
    const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const cfAccount = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");

    if (!cfToken || !cfAccount) {
      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Cloudflare credentials missing",
          details: "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be configured as server secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const model = "@cf/black-forest-labs/flux-1-schnell";
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/${model}`;

    console.log(`[generate-image] Cloudflare FLUX model=${model}`);

    const cfResponse = await fetch(cfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, steps: 4 }),
    });

    if (!cfResponse.ok) {
      const errText = await cfResponse.text();
      let errMessage = `Cloudflare returned HTTP ${cfResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMessage = errJson.errors?.[0]?.message || errJson.error?.message || errMessage;
      } catch { /* use default */ }

      console.error(`[generate-image] Cloudflare error ${cfResponse.status}: ${errMessage}`);

      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });

      if (cfResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Provider returned HTTP 429", details: errMessage }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Cloudflare FLUX request failed", details: errMessage }),
        { status: cfResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cfData = await cfResponse.json();

    if (cfData.success === false) {
      const errMsg = cfData.errors?.[0]?.message || "Cloudflare returned an error";
      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });
      return new Response(
        JSON.stringify({ success: false, error: "Cloudflare FLUX request failed", details: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const base64Image = cfData.result?.image;
    if (!base64Image) {
      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });
      return new Response(
        JSON.stringify({ success: false, error: "Generation failed", details: "No image returned from Cloudflare" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Convert base64 to JPEG bytes and upload to private storage
    const bytes = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0));
    const filePath = `${user.id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("generated-images")
      .upload(filePath, bytes, { contentType: "image/jpeg" });

    let storedUrl: string;
    if (uploadErr) {
      console.error(`[generate-image] Storage upload failed: ${uploadErr.message}`);
      storedUrl = `data:image/jpeg;base64,${base64Image}`;
    } else {
      const { data: urlData } = supabase.storage.from("generated-images").createSignedUrl(filePath, 60 * 60 * 24 * 7);
      storedUrl = urlData.signedUrl || `data:image/jpeg;base64,${base64Image}`;
    }

    const { data: row, error: dbErr } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: "image",
        prompt,
        provider: "cloudflare",
        model,
        status: "completed",
        result_url: storedUrl,
        metadata: { all_urls: [storedUrl], settings: settings || {} },
      })
      .select()
      .single();

    if (dbErr) {
      console.error(`[generate-image] DB error: ${dbErr.message}`);
      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });
      return new Response(
        JSON.stringify({ success: false, error: "Database write failed", details: dbErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[generate-image] Cloudflare success, image stored`);

    return new Response(
      JSON.stringify({ success: true, data: row, balance: newBalance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[generate-image] Unhandled error: ${(err as Error).message}`);
    return new Response(
      JSON.stringify({ success: false, error: "Generation failed", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
