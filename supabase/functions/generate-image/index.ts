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

    let imageUrls: string[] = [];
    let model = "";

    if (provider === "google") {
      const googleKey = Deno.env.get("GOOGLE_API_KEY");
      if (!googleKey) {
        return new Response(
          JSON.stringify({ success: false, error: "GOOGLE_API_KEY is missing", details: "The GOOGLE_API_KEY secret has not been configured." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      model = Deno.env.get("GOOGLE_IMAGE_MODEL") || "gemini-3.1-flash-image";

      console.log(`[generate-image] Google model=${model} aspect=${aspectRatio} n=${n}`);

      // Use Gemini generateContent API with responseModalities for native image generation models
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

        await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });

        if (googleResponse.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "Provider returned HTTP 429", details: errMessage }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "Google API request failed", details: errMessage }),
          { status: googleResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const googleData = await googleResponse.json();

      // Extract images from candidates[].content.parts[]
      const candidates = googleData.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            const ext = mimeType.includes("jpeg") ? "jpg" : "png";
            imageUrls.push(`data:${mimeType};base64,${part.inlineData.data}`);
          } else if (part.inlineData?.inlineData) {
            // Some responses nest differently
            const data = part.inlineData.inlineData;
            if (data?.data) {
              const mimeType = data.mimeType || "image/png";
              imageUrls.push(`data:${mimeType};base64,${data.data}`);
            }
          }
        }
      }

      console.log(`[generate-image] Google returned ${imageUrls.length} images`);
    } else {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "OPENAI_API_KEY is missing", details: "The OPENAI_API_KEY secret has not been configured." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      model = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1";

      const sizeMap: Record<string, string> = {
        "1:1": "1024x1024",
        "16:9": "1536x1024",
        "9:16": "1024x1536",
        "4:3": "1024x1024",
        "3:4": "1024x1024",
      };
      const size = sizeMap[aspectRatio] || "1024x1024";

      // gpt-image-2 uses low/medium/high/auto instead of standard/hd
      const qualityMap: Record<string, string> = {
        "standard": "medium",
        "hd": "high",
      };
      const openaiQuality = qualityMap[quality] || "auto";

      console.log(`[generate-image] OpenAI model=${model} size=${size} quality=${openaiQuality} n=${n}`);

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
          quality: openaiQuality,
          output_format: "png",
        }),
      });

      if (!openaiResponse.ok) {
        const errText = await openaiResponse.text();
        let errMessage = `OpenAI returned HTTP ${openaiResponse.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMessage = errJson.error?.message || errMessage;
        } catch { /* use default */ }

        console.error(`[generate-image] OpenAI error ${openaiResponse.status}: ${errMessage}`);

        await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });

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

      console.log(`[generate-image] OpenAI returned ${imageUrls.length} images`);
    }

    if (imageUrls.length === 0) {
      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });
      return new Response(
        JSON.stringify({ success: false, error: "Generation failed", details: "No images returned from provider" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upload images to storage and get public URLs
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
      console.error(`[generate-image] DB error: ${dbErr.message}`);
      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Image Generation Refund" });
      return new Response(
        JSON.stringify({ success: false, error: "Database write failed", details: dbErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: row, balance: newBalance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[generate-image] Unhandled error: ${err.message}`);
    return new Response(
      JSON.stringify({ success: false, error: "Generation failed", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
