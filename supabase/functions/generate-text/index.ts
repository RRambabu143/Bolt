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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "OPENAI_API_KEY is missing",
          details: "The OPENAI_API_KEY secret has not been configured for this Edge Function.",
        }),
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
    const { prompt, settings, action } = body;

    if (action === "enhance") {
      return await handleEnhance(req, prompt, openaiKey);
    }

    if (!prompt || prompt.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tone = settings?.tone || "Professional";
    const format = settings?.format || "Article";
    const creativity = Math.max(0, Math.min(100, settings?.creativity ?? 60));
    const model = Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o";

    const effort = creativity > 70 ? "high" : creativity > 40 ? "medium" : "low";

    const instructions = `You are a professional creative writing assistant. Generate ${format.toLowerCase()} content with a ${tone.toLowerCase()} tone. Format the output in clean markdown.`;

    console.log(`[generate-text] model=${model} tone=${tone} format=${format} creativity=${creativity} effort=${effort}`);

    const requestBody: Record<string, unknown> = {
      model,
      instructions,
      input: prompt,
      max_output_tokens: 4096,
    };

    // GPT-5+ models use reasoning effort instead of temperature
    if (model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3")) {
      requestBody.reasoning = { effort };
    } else {
      requestBody.temperature = creativity / 100;
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      let errMessage = `OpenAI returned HTTP ${openaiResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMessage = errJson.error?.message || errMessage;
      } catch { /* use default */ }

      console.error(`[generate-text] OpenAI error ${openaiResponse.status}: ${errMessage}`);

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

    let generatedText = "";
    if (openaiData.output && Array.isArray(openaiData.output)) {
      for (const item of openaiData.output) {
        if (item.type === "message" && item.content) {
          for (const part of item.content) {
            if (part.type === "output_text" && part.text) {
              generatedText += part.text;
            }
          }
        }
      }
    }
    if (!generatedText && openaiData.output_text) {
      generatedText = openaiData.output_text;
    }

    console.log(`[generate-text] Success, text length=${generatedText.length}`);

    const { data: row, error: dbErr } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: "text",
        prompt,
        provider: "openai",
        model,
        status: "completed",
        result_text: generatedText,
        metadata: { tone, format, creativity, settings: settings || {} },
      })
      .select()
      .single();

    if (dbErr) {
      console.error(`[generate-text] DB error: ${dbErr.message}`);
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
    console.error(`[generate-text] Unhandled error: ${err.message}`);
    return new Response(
      JSON.stringify({ success: false, error: "Generation failed", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleEnhance(req: Request, prompt: string, openaiKey: string): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };

  try {
    const model = Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o";
    const enhancePrompt = `Enhance this creative prompt by adding specific details about composition, style, lighting, mood, and technical qualities. Keep it concise but vivid. Original prompt: "${prompt}". Return only the enhanced prompt, no explanation.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        input: enhancePrompt,
        max_output_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      let errMessage = `OpenAI returned HTTP ${openaiResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMessage = errJson.error?.message || errMessage;
      } catch { /* use default */ }
      return new Response(
        JSON.stringify({ success: false, error: "Enhancement failed", details: errMessage }),
        { status: openaiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await openaiResponse.json();
    let enhanced = "";
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && item.content) {
          for (const part of item.content) {
            if (part.type === "output_text" && part.text) enhanced += part.text;
          }
        }
      }
    }
    if (!enhanced && data.output_text) enhanced = data.output_text;

    return new Response(
      JSON.stringify({ success: true, data: { enhanced_prompt: enhanced || prompt } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Enhancement failed", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
