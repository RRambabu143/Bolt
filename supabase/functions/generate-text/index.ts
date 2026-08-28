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
          details: "The OPENAI_API_KEY secret has not been configured. Set it with: npx supabase secrets set OPENAI_API_KEY=sk-...",
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
    const { prompt, settings } = body;

    if (!prompt || prompt.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tone = settings?.tone || "Professional";
    const format = settings?.format || "Article";
    const creativity = Math.max(0, Math.min(100, settings?.creativity ?? 60));
    const temperature = creativity / 100;
    const model = Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o";

    const systemPrompt = `You are a professional creative writing assistant. Generate ${format.toLowerCase()} content with a ${tone.toLowerCase()} tone. Format the output in clean markdown.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: 4096,
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
    const generatedText = openaiData.choices?.[0]?.message?.content || "";

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
