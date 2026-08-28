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
    const googleKey = Deno.env.get("GOOGLE_API_KEY");

    if (!googleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "GOOGLE_API_KEY is missing", details: "The GOOGLE_API_KEY secret has not been configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
    const model = Deno.env.get("GOOGLE_VIDEO_MODEL") || "veo-3.1-generate-preview";
    const aspectRatio = settings?.aspect_ratio || "16:9";
    const durationSeconds = String(settings?.duration_seconds || 8);
    const resolution = settings?.resolution || "720p";
    const includeAudio = settings?.include_audio !== false;

    if (!prompt || prompt.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: row, error: dbErr } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: "video",
        prompt,
        provider: "google",
        model,
        status: "processing",
        metadata: { aspect_ratio: aspectRatio, duration_seconds: durationSeconds, resolution, include_audio: includeAudio, settings: settings || {} },
      })
      .select()
      .single();

    if (dbErr) {
      console.error(`[generate-video] DB insert error: ${dbErr.message}`);
      return new Response(
        JSON.stringify({ success: false, error: "Database write failed", details: dbErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[generate-video] model=${model} aspect=${aspectRatio} duration=${durationSeconds}s resolution=${resolution} audio=${includeAudio}`);

    EdgeRuntime.waitUntil((async () => {
      try {
        const videoResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": googleKey,
            },
            body: JSON.stringify({
              instances: [{ prompt }],
              parameters: {
                aspectRatio,
                durationSeconds,
                resolution,
                generateAudio: includeAudio,
                personGeneration: "allow_adult",
              },
            }),
          },
        );

        if (!videoResponse.ok) {
          const errText = await videoResponse.text();
          let errMessage = `Google API returned HTTP ${videoResponse.status}`;
          try {
            const errJson = JSON.parse(errText);
            errMessage = errJson.error?.message || errMessage;
          } catch { /* use default */ }

          console.error(`[generate-video] Veo submit error ${videoResponse.status}: ${errMessage}`);
          await supabase.from("generations").update({
            status: "failed",
            error_message: errMessage,
          }).eq("id", row.id);
          return;
        }

        const videoData = await videoResponse.json();
        const operationName = videoData.name;

        console.log(`[generate-video] Operation started: ${operationName}`);

        let attempts = 0;
        const maxAttempts = 120;
        const pollInterval = 10000;

        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, pollInterval));
          attempts++;

          const pollResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}`,
            {
              headers: {
                "x-goog-api-key": googleKey,
              },
            },
          );

          if (!pollResponse.ok) {
            console.warn(`[generate-video] Poll attempt ${attempts} returned ${pollResponse.status}`);
            continue;
          }

          const pollData = await pollResponse.json();

          if (pollData.done) {
            if (pollData.error) {
              console.error(`[generate-video] Operation failed: ${pollData.error.message}`);
              await supabase.from("generations").update({
                status: "failed",
                error_message: pollData.error.message || "Video generation failed",
              }).eq("id", row.id);
              return;
            }

            // Response path: response.generateVideoResponse.generatedSamples[0].video.uri
            const videoUri = pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
              || pollData.response?.generatedSamples?.[0]?.video?.uri;

            if (!videoUri) {
              console.error("[generate-video] No video URI in response");
              await supabase.from("generations").update({
                status: "failed",
                error_message: "No video URL returned from provider",
              }).eq("id", row.id);
              return;
            }

            console.log(`[generate-video] Downloading video from ${videoUri.substring(0, 80)}...`);

            const videoFetch = await fetch(`${videoUri}&key=${googleKey}`);
            if (!videoFetch.ok) {
              console.error(`[generate-video] Video download failed: ${videoFetch.status}`);
              await supabase.from("generations").update({
                status: "failed",
                error_message: "Failed to download video from provider",
              }).eq("id", row.id);
              return;
            }

            const videoBytes = new Uint8Array(await videoFetch.arrayBuffer());
            const filePath = `${user.id}/${crypto.randomUUID()}.mp4`;
            const { error: uploadErr } = await supabase.storage
              .from("generated-videos")
              .upload(filePath, videoBytes, { contentType: "video/mp4" });

            if (uploadErr) {
              console.error(`[generate-video] Storage upload failed: ${uploadErr.message}`);
              await supabase.from("generations").update({
                status: "failed",
                error_message: "Storage upload failed: " + uploadErr.message,
              }).eq("id", row.id);
              return;
            }

            const { data: { publicUrl } } = supabase.storage.from("generated-videos").getPublicUrl(filePath);

            console.log(`[generate-video] Video uploaded to ${publicUrl}`);

            await supabase.from("generations").update({
              status: "completed",
              result_url: publicUrl,
              metadata: { ...row.metadata, storage_path: filePath },
            }).eq("id", row.id);
            return;
          }

          if (attempts % 5 === 0) {
            console.log(`[generate-video] Still polling... attempt ${attempts}/${maxAttempts}`);
          }
        }

        console.error("[generate-video] Timed out after " + maxAttempts + " attempts");
        await supabase.from("generations").update({
          status: "failed",
          error_message: "Video generation timed out",
        }).eq("id", row.id);
      } catch (err) {
        console.error(`[generate-video] Background task error: ${err.message}`);
        await supabase.from("generations").update({
          status: "failed",
          error_message: err.message,
        }).eq("id", row.id);
      }
    })());

    return new Response(
      JSON.stringify({ success: true, data: row }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[generate-video] Unhandled error: ${err.message}`);
    return new Response(
      JSON.stringify({ success: false, error: "Generation failed", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
