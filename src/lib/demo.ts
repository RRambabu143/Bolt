import type { CreditTransaction, GenerateRequest, Generation, UsageSummary } from "../types";

const KEY = "mindmesh-demo-generations";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  async generate(x: GenerateRequest): Promise<Generation> {
    await wait(900);
    const now = new Date().toISOString();
    const row: Generation = {
      id: crypto.randomUUID(),
      user_id: "demo-user",
      type: x.type,
      prompt: x.prompt,
      provider: "demo",
      model:
        x.type === "text"
          ? "claude-sonnet-5-demo"
          : x.type === "image"
            ? "gemini-flash-demo"
            : "veo-demo",
      status: x.type === "video" ? "processing" : "completed",
      result_text:
        x.type === "text"
          ? "# MindMesh Demo Output\n\n" +
            x.prompt +
            "\n\nConnect your Claude key to replace this preview with live output."
          : null,
      result_url:
        x.type === "image"
          ? placeholder(x.prompt, (x.settings as Record<string, unknown>)?.aspect_ratio as string)
          : null,
      metadata: { demo: true },
      error_message: null,
      favorite: false,
      created_at: now,
      updated_at: now,
    };
    write([row, ...read()]);
    return row;
  },

  async poll(id: string): Promise<Generation> {
    await wait(650);
    const rows = read();
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) throw new Error("Demo generation not found");
    rows[i] = {
      ...rows[i],
      status: "completed",
      result_url: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
      updated_at: new Date().toISOString(),
    };
    write(rows);
    return rows[i];
  },

  async list(): Promise<Generation[]> {
    await wait(250);
    return read();
  },

  async remove(id: string) {
    write(read().filter((r) => r.id !== id));
  },

  async favorite(id: string, favorite: boolean): Promise<Generation> {
    const rows = read().map((r) => (r.id === id ? { ...r, favorite } : r));
    write(rows);
    return rows.find((r) => r.id === id)!;
  },

  async enhance(prompt: string, _type: string): Promise<string> {
    await wait(500);
    return (
      prompt.trim() +
      ". Create a highly detailed composition with a clear focal subject, intentional pacing, professional lighting, coherent visual language, rich atmospheric detail, and a memorable final impression."
    );
  },

  usage(): UsageSummary {
    const rows = read().filter(
      (r) =>
        r.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10),
    );
    const count = (t: string) => rows.filter((r) => r.type === t).length;
    return {
      text: count("text"),
      image: count("image"),
      video: count("video"),
      total: rows.length,
      daily_limit: 50,
      remaining: Math.max(0, 50 - rows.length),
    };
  },

  mindChipsBalance(): number {
    return 500;
  },

  mindChipsTransactions(): CreditTransaction[] {
    return [
      {
        id: "demo-bonus",
        user_id: "demo-user",
        amount: 500,
        description: "Welcome Bonus",
        type: "bonus",
        generation_type: null,
        created_at: new Date().toISOString(),
      },
    ];
  },
};
