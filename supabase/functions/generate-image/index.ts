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
    const provider = settings?.provider || "google";
    const aspectRatio = settings?.aspect_ratio || "1:1";
    const n = Math.min(4, Math.max(1, settings?.n || 1));

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

    let result: { row: Record<string, unknown>; balance: number };

    if (provider === "cloudflare") {
      result = await handleCloudflare(prompt, settings, user.id, supabase, newBalance);
    } else {
      result = await handleGoogle(prompt, settings, aspectRatio, n, user.id, supabase, newBalance);
    }

    // Refund on failure if the handler threw and we still want to refund
    return new Response(
      JSON.stringify({ success: true, data: result.row, balance: result.balance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = (err as Error).message || "Generation failed";
    console.error(`[generate-image] Unhandled error: ${msg}`);

    // Best-effort refund on unhandled errors
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const userClient = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });
        await userClient.rpc("refund_mind_chips", { p_amount: 10, p_description: "Image Generation Refund" });
      }
    } catch { /* ignore refund errors */ }

    return new Response(
      JSON.stringify({ success: false, error: "Generation failed", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ---------------------------------------------------------------------------
// Cloudflare FLUX 1 Schnell
// ---------------------------------------------------------------------------

async function handleCloudflare(
  prompt: string,
  settings: Record<string, unknown> | undefined,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  balance: number,
): Promise<{ row: Record<string, unknown>; balance: number }> {
  const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const cfAccount = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");

  if (!cfToken || !cfAccount) {
    throw new Error("Cloudflare credentials missing. CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be configured as server secrets.");
  }

  const model = "@cf/black-forest-labs/flux-1-schnell";
  const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/${model}`;

  console.log(`[generate-image] Cloudflare FLUX model=${model}`);

  const cfResponse = await fetch(url, {
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
    throw new Error(`Cloudflare FLUX request failed: ${errMessage}`);
  }

  const cfData = await cfResponse.json();

  // Cloudflare may return success:false in the body even with 200
  if (cfData.success === false) {
    const errMsg = cfData.errors?.[0]?.message || "Cloudflare returned an error";
    throw new Error(`Cloudflare FLUX request failed: ${errMsg}`);
  }

  const base64Image = cfData.result?.image;
  if (!base64Image) {
    throw new Error("Cloudflare FLUX returned no image data");
  }

  // Convert base64 to JPEG bytes
  const bytes = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0));
  const filePath = `${userId}/${crypto.randomUUID()}.jpg`;
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
      user_id: userId,
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
    throw new Error(`Database write failed: ${dbErr.message}`);
  }

  console.log(`[generate-image] Cloudflare success, image stored`);
  return { row: row as Record<string, unknown>, balance };
}

// ---------------------------------------------------------------------------
// Google Gemini (unchanged)
// ---------------------------------------------------------------------------

async function handleGoogle(
  prompt: string,
  settings: Record<string, unknown> | undefined,
  aspectRatio: string,
  n: number,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  balance: number,
): Promise<{ row: Record<string, unknown>; balance: number }> {
  const googleKey = Deno.env.get("GOOGLE_API_KEY");
  if (!googleKey) {
    throw new Error("GOOGLE_API_KEY is missing. The GOOGLE_API_KEY secret has not been configured.");
  }
  const model = Deno.env.get("GOOGLE_IMAGE_MODEL") || "gemini-3.1-flash-image";

  console.log(`[generate-image] Google model=${model} aspect=${aspectRatio} n=${n}`);

  const imageUrls: string[] = [];

  const googleResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": googleKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      }),
    },
  );

  if (!googleResponse.ok) {
    const errText = await googleResponse.text();
    let errMessage = `Google API returned HTTP ${googleResponse.status}`;
    try {
      const errJson = JSON.parse(errText);
      errMessage = errJson.error?.message || errMessage;
    } catch { /* use default */ }

    console.error(`[generate-image] Google error ${googleResponse.status}: ${errMessage}`);

    if (googleResponse.status === 429) {
      throw new Error(`Provider returned HTTP 429: ${errMessage}`);
    }

    throw new Error(`Google API request failed: ${errMessage}`);
  }

  const googleData = await googleResponse.json();

  const candidates = googleData.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || "image/png";
        imageUrls.push(`data:${mimeType};base64,${part.inlineData.data}`);
      } else if (part.inlineData?.inlineData) {
        const data = part.inlineData.inlineData;
        if (data?.data) {
          const mimeType = data.mimeType || "image/png";
          imageUrls.push(`data:${mimeType};base64,${data.data}`);
        }
      }
    }
  }

  console.log(`[generate-image] Google returned ${imageUrls.length} images`);

  if (imageUrls.length === 0) {
    throw new Error("No images returned from provider");
  }

  // Upload images to storage and get public URLs
  const storedUrls: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const dataUrl = imageUrls[i];
    if (dataUrl.startsWith("data:")) {
      const base64 = dataUrl.split(",")[1];
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const filePath = `${userId}/${crypto.randomUUID()}.png`;
      const { error: uploadErr } = await supabase.storage
        .from("generated-images")
        .upload(filePath, bytes, { contentType: "image/png" });

      if (uploadErr) {
        console.error(`[generate-image] Storage upload failed: ${uploadErr.message}`);
        storedUrls.push(dataUrl);
      } else {
        const { data: { publicUrl } } = supabase.storage.from("generated-images").getPublicUrl(filePath);
        storedUrls.push(publicUrl);
      }
    } else {
      storedUrls.push(dataUrl);
    }
  }

  const primaryUrl = storedUrls[0];
  const { data: row, error: dbErr } = await supabase
    .from("generations")
    .insert({
      user_id: userId,
      type: "image",
      prompt,
      provider: "google",
      model,
      status: "completed",
      result_url: primaryUrl,
      metadata: { aspect_ratio: aspectRatio, n, all_urls: storedUrls, settings: settings || {} },
    })
    .select()
    .single();

  if (dbErr) {
    console.error(`[generate-image] DB error: ${dbErr.message}`);
    throw new Error(`Database write failed: ${dbErr.message}`);
  }

  return { row: row as Record<string, unknown>, balance };
}
