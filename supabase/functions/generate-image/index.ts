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
    const provider = settings?.provider || "openai";
    const aspectRatio = settings?.aspect_ratio || "1:1";
    const quality = settings?.quality || "standard";
    const n = Math.min(4, Math.max(1, settings?.n || 1));

    if (!prompt || prompt.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sizeMap: Record<string, string> = {
      "1:1": "1024x1024",
      "16:9": "1792x1024",
      "9:16": "1024x1792",
      "4:3": "1024x1024",
      "3:4": "1024x1024",
    };
    const size = sizeMap[aspectRatio] || "1024x1024";

    let imageUrls: string[] = [];
    let model = "";

    if (provider === "google") {
      const googleKey = Deno.env.get("GOOGLE_API_KEY");
      if (!googleKey) {
        return new Response(
          JSON.stringify({ success: false, error: "GOOGLE_API_KEY is missing", details: "Set it with: npx supabase secrets set GOOGLE_API_KEY=..." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      model = Deno.env.get("GOOGLE_IMAGE_MODEL") || "imagen-3.0-generate-002";

      const googleResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            number_of_images: n,
            aspect_ratio: aspectRatio,
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

        if (googleResponse.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "Provider returned HTTP 429", details: errMessage }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "Google API authentication failed", details: errMessage }),
          { status: googleResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const googleData = await googleResponse.json();
      const images = googleData.predictions || googleData.images || [];
      for (const img of images) {
        if (img.bytesBase64Encoded) {
          imageUrls.push(`data:image/png;base64,${img.bytesBase64Encoded}`);
        } else if (img.url) {
          imageUrls.push(img.url);
        }
      }
    } else {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "OPENAI_API_KEY is missing", details: "Set it with: npx supabase secrets set OPENAI_API_KEY=sk-..." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      model = Deno.env.get("OPENAI_IMAGE_MODEL") || "dall-e-3";

      const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: Math.min(1, n),
          size,
          quality,
          response_format: "b64_json",
        }),
      });

      if (!openaiResponse.ok) {
        const errText = await openaiResponse.text();
        let errMessage = `OpenAI returned HTTP ${openaiResponse.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMessage = errJson.error?.message || errMessage;
        } catch { /* use default */ }

        if (openaiResponse.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "Provider returned HTTP 429", details: errMessage }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "OpenAI request failed", details: errMessage }),
          { status: openaiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const openaiData = await openaiResponse.json();
      for (const img of openaiData.data || []) {
        if (img.b64_json) {
          imageUrls.push(`data:image/png;base64,${img.b64_json}`);
        } else if (img.url) {
          imageUrls.push(img.url);
        }
      }
    }

    if (imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Generation failed", details: "No images returned from provider" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const storedUrls: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const dataUrl = imageUrls[i];
      if (dataUrl.startsWith("data:")) {
        const base64 = dataUrl.split(",")[1];
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const filePath = `${user.id}/${crypto.randomUUID()}.png`;
        const { error: uploadErr } = await supabase.storage
          .from("generated-images")
          .upload(filePath, bytes, { contentType: "image/png" });

        if (uploadErr) {
          console.error("Storage upload failed:", uploadErr.message);
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
        user_id: user.id,
        type: "image",
        prompt,
        provider,
        model,
        status: "completed",
        result_url: primaryUrl,
        metadata: { aspect_ratio: aspectRatio, quality, n, all_urls: storedUrls, settings: settings || {} },
      })
      .select()
      .single();

    if (dbErr) {
      return new Response(
        JSON.stringify({ success: false, error: "Database write failed", details: dbErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: row }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Generation failed", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
