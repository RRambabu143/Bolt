import { supabase } from "./supabase";
import type {
  GenerateRequest,
  Generation,
  HistoryFilter,
  UsageSummary,
} from "../types";

export const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

function getFunctionError(error: unknown, functionName: string): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("Failed to send a request") || msg.includes("fetch")) {
      return `${functionName} Edge Function is not deployed or unreachable. Check that it was deployed correctly.`;
    }
    return msg;
  }
  return `${functionName} failed with an unknown error`;
}

async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    throw new Error(getFunctionError(error, name));
  }

  if (data?.success === false) {
    const msg = data.error || "Generation failed";
    const details = data.details ? `: ${data.details}` : "";
    throw new Error(`${msg}${details}`);
  }

  if (!data) {
    throw new Error(`${name} returned no data`);
  }

  return data.data as T;
}

export async function generate(req: GenerateRequest): Promise<Generation> {
  return invokeFunction<Generation>(
    req.type === "text" ? "generate-text" : req.type === "image" ? "generate-image" : "generate-video",
    { prompt: req.prompt, settings: req.settings },
  );
}

export async function pollVideoStatus(id: string): Promise<Generation> {
  return invokeFunction<Generation>("video-status", { id });
}

export async function enhancePrompt(prompt: string, type: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-text", {
    body: { action: "enhance", prompt, type },
  });

  if (error) throw new Error(getFunctionError(error, "enhance-prompt"));
  if (data?.success === false) throw new Error(data.error || "Enhancement failed");
  return data?.data?.enhanced_prompt || prompt;
}

export async function listGenerations(
  filter: HistoryFilter = "all",
  search = "",
): Promise<Generation[]> {
  let query = supabase.from("generations").select("*").order("created_at", { ascending: false });

  if (filter === "text" || filter === "image" || filter === "video") {
    query = query.eq("type", filter);
  } else if (filter === "favorites") {
    query = query.eq("favorite", true);
  }

  if (search) {
    query = query.ilike("prompt", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data || []) as Generation[];
}

export async function deleteGeneration(id: string): Promise<void> {
  const { error } = await supabase.from("generations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setFavorite(id: string, favorite: boolean): Promise<Generation> {
  const { data, error } = await supabase
    .from("generations")
    .update({ favorite })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Generation;
}

export async function getUsage(): Promise<UsageSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("generations")
    .select("type, created_at")
    .gte("created_at", today + "T00:00:00Z")
    .lt("created_at", today + "T23:59:59Z");

  if (error) throw new Error(error.message);

  const rows = data || [];
  const count = (t: string) => rows.filter((r) => r.type === t).length;
  const dailyLimit = 50;

  return {
    text: count("text"),
    image: count("image"),
    video: count("video"),
    total: rows.length,
    daily_limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - rows.length),
  };
}

export function exportText(row: Generation) {
  const blob = new Blob([row.result_text || ""], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mindmesh-" + row.id + ".txt";
  a.click();
  URL.revokeObjectURL(url);
}
