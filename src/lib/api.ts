import { supabase } from "./supabase";
import { demo } from "./demo";
import type {
  GenerateRequest,
  Generation,
  HistoryFilter,
  UsageSummary,
} from "../types";
export const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
async function invoke<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export async function generate(x: GenerateRequest) {
  return demoMode
    ? demo.generate(x)
    : (await invoke<{ generation: Generation }>("generate", { ...x }))
        .generation;
}
export async function pollVideo(id: string) {
  return demoMode
    ? demo.poll(id)
    : (await invoke<{ generation: Generation }>("video-status", { id }))
        .generation;
}
export async function enhancePrompt(prompt: string, kind: string) {
  return demoMode
    ? demo.enhance(prompt, kind)
    : (await invoke<{ prompt: string }>("enhance-prompt", { prompt, kind }))
        .prompt;
}
export async function listGenerations(
  filter: HistoryFilter = "all",
  search = "",
) {
  if (demoMode) {
    const rows = await demo.list();
    return rows.filter(
      (r) =>
        (filter === "all" ||
          (filter === "favorites" ? r.favorite : r.kind === filter)) &&
        (!search || r.prompt.toLowerCase().includes(search.toLowerCase())),
    );
  }
  return (
    await invoke<{ generations: Generation[] }>("history", {
      action: "list",
      filter,
      search,
    })
  ).generations;
}
export async function deleteGeneration(id: string) {
  if (demoMode) return demo.remove(id);
  await invoke("history", { action: "delete", id });
}
export async function setFavorite(id: string, favorite: boolean) {
  return demoMode
    ? demo.favorite(id, favorite)
    : (
        await invoke<{ generation: Generation }>("history", {
          action: "favorite",
          id,
          favorite,
        })
      ).generation;
}
export async function getUsage() {
  return demoMode
    ? demo.usage()
    : (await invoke<{ usage: UsageSummary }>("history", { action: "usage" }))
        .usage;
}
export function exportText(row: Generation) {
  const blob = new Blob([row.output_text || ""], {
      type: "text/plain;charset=utf-8",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "mindmesh-" + row.id + ".txt";
  a.click();
  URL.revokeObjectURL(url);
}
