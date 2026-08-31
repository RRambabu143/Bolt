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
    const claudeKey = Deno.env.get("cluad_api_key");

    if (!claudeKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "cluad_api_key is missing",
          details: "The Claude API key secret has not been configured for this Edge Function.",
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

    const { createClient } = await import("npm:@supabase/supabase-js@2.112.4");
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
      return await handleEnhance(prompt, claudeKey);
    }

    if (!prompt || prompt.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deduct 1 Mind Chip for text generation
    const COST = 1;
    const { data: newBalance, error: deductErr } = await userClient.rpc("deduct_mind_chips", {
      p_amount: COST,
      p_description: "Text Generation",
      p_generation_type: "text",
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

    const tone = settings?.tone || "Professional";
    const format = settings?.format || "Article";
    const creativity = Math.max(0, Math.min(100, settings?.creativity ?? 60));
    const model = Deno.env.get("CLAUDE_TEXT_MODEL") || "claude-sonnet-5";

    const systemPrompt = `You are a professional creative writing assistant. Generate ${format.toLowerCase()} content with a ${tone.toLowerCase()} tone. Format the output in clean markdown.`;

    console.log(`[generate-text] model=${model} tone=${tone} format=${format} creativity=${creativity}`);

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      let errMessage = `Claude returned HTTP ${claudeResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMessage = errJson.error?.message || errMessage;
      } catch { /* use default */ }

      console.error(`[generate-text] Claude error ${claudeResponse.status}: ${errMessage}`);

      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Text Generation Refund" });

      if (claudeResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Provider returned HTTP 429", details: errMessage }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Claude request failed", details: errMessage }),
        { status: claudeResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const claudeData = await claudeResponse.json();

    let generatedText = "";
    if (claudeData.content && Array.isArray(claudeData.content)) {
      for (const block of claudeData.content) {
        if (block.type === "text" && block.text) {
          generatedText += block.text;
        }
      }
    }

    console.log(`[generate-text] Success, text length=${generatedText.length}`);

    const { data: row, error: dbErr } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: "text",
        prompt,
        provider: "anthropic",
        model,
        status: "completed",
        result_text: generatedText,
        metadata: { tone, format, creativity, settings: settings || {} },
      })
      .select()
      .single();

    if (dbErr) {
      console.error(`[generate-text] DB error: ${dbErr.message}`);
      await userClient.rpc("refund_mind_chips", { p_amount: COST, p_description: "Text Generation Refund" });
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
    console.error(`[generate-text] Unhandled error: ${(err as Error).message}`);
    return new Response(
      JSON.stringify({ success: false, error: "Generation failed", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleEnhance(prompt: string, claudeKey: string): Promise<Response> {
  try {
    const model = Deno.env.get("CLAUDE_TEXT_MODEL") || "claude-sonnet-5";
    const enhancePrompt = `Enhance this creative prompt by adding specific details about composition, style, lighting, mood, and technical qualities. Keep it concise but vivid. Original prompt: "${prompt}". Return only the enhanced prompt, no explanation.`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [{ role: "user", content: enhancePrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      let errMessage = `Claude returned HTTP ${claudeResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMessage = errJson.error?.message || errMessage;
      } catch { /* use default */ }
      return new Response(
        JSON.stringify({ success: false, error: "Enhancement failed", details: errMessage }),
        { status: claudeResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await claudeResponse.json();
    let enhanced = "";
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text" && block.text) enhanced += block.text;
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: { enhanced_prompt: enhanced || prompt } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Enhancement failed", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
