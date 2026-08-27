import type { GenerateRequest, Generation, UsageSummary } from "../types";
const KEY = "mindmesh-demo-generations",
  wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function read(): Generation[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function write(rows: Generation[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}
function placeholder(prompt: string, aspect = "16:9") {
  const [w, h] =
    aspect === "9:16"
      ? [900, 1600]
      : aspect === "1:1"
        ? [1200, 1200]
        : [1600, 900];
  return (
    "https://placehold.co/" +
    w +
    "x" +
    h +
    "/161821/caff85?text=" +
    encodeURIComponent(prompt.slice(0, 80))
  );
}
export const demo = {
  async generate(x: GenerateRequest) {
    await wait(900);
    const now = new Date().toISOString(),
      row: Generation = {
        id: crypto.randomUUID(),
        user_id: "demo-user",
        kind: x.kind,
        provider: "demo",
        prompt: x.prompt,
        enhanced_prompt: null,
        model:
          x.kind === "text"
            ? "gpt-5.6-demo"
            : x.kind === "image"
              ? "gemini-image-demo"
              : "veo-demo",
        status: x.kind === "video" ? "processing" : "completed",
        output_text:
          x.kind === "text"
            ? "# MindMesh Demo Output\n\n" +
              x.prompt +
              "\n\nConnect your OpenAI key to replace this preview with live GPT output."
            : null,
        asset_url:
          x.kind === "image"
            ? placeholder(x.prompt, x.settings.aspect_ratio)
            : null,
        thumbnail_url: null,
        storage_path: null,
        provider_job_id: x.kind === "video" ? "demo-operation" : null,
        settings: x.settings,
        metadata: { demo: true },
        error: null,
        favorite: false,
        created_at: now,
        updated_at: now,
      };
    write([row, ...read()]);
    return row;
  },
  async poll(id: string) {
    await wait(650);
    const rows = read(),
      i = rows.findIndex((r) => r.id === id);
    if (i < 0) throw new Error("Demo generation not found");
    rows[i] = {
      ...rows[i],
      status: "completed",
      asset_url: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
      updated_at: new Date().toISOString(),
    };
    write(rows);
    return rows[i];
  },
  async list() {
    await wait(250);
    return read();
  },
  async remove(id: string) {
    write(read().filter((r) => r.id !== id));
  },
  async favorite(id: string, favorite: boolean) {
    const rows = read().map((r) => (r.id === id ? { ...r, favorite } : r));
    write(rows);
    return rows.find((r) => r.id === id)!;
  },
  async enhance(prompt: string, kind: string) {
    await wait(500);
    return (
      prompt.trim() +
      ". Create a highly detailed " +
      kind +
      " composition with a clear focal subject, intentional pacing, professional lighting, coherent visual language, rich atmospheric detail, and a memorable final impression."
    );
  },
  usage(): UsageSummary {
    const rows = read().filter(
        (r) =>
          r.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10),
      ),
      count = (k: string) => rows.filter((r) => r.kind === k).length;
    return {
      text: count("text"),
      image: count("image"),
      video: count("video"),
      total: rows.length,
      daily_limit: 50,
      remaining: Math.max(0, 50 - rows.length),
    };
  },
};
