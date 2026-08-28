import type { GenerationType } from "../types";

export function validatePrompt(prompt: string) {
  const value = prompt.trim();
  if (value.length < 3) return "Prompt must contain at least 3 characters.";
  if (value.length > 4000) return "Prompt cannot exceed 4,000 characters.";
  return null;
}

export function normalizeSettings(
  type: GenerationType,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (type === "text")
    return {
      tone: (input.tone as string) || "Professional",
      format: (input.format as string) || "Article",
      creativity: Math.max(0, Math.min(100, (input.creativity as number) ?? 60)),
    };
  if (type === "image")
    return {
      provider: (input.provider as string) || "openai",
      model: (input.model as string) || "dall-e-3",
      aspect_ratio: (input.aspect_ratio as string) || "1:1",
      n: Math.min(4, Math.max(1, (input.n as number) ?? 1)),
      quality: (input.quality as string) || "standard",
    };
  return {
    model: (input.model as string) || "veo-3.1-generate-preview",
    aspect_ratio: ["16:9", "9:16"].includes((input.aspect_ratio as string) || "")
      ? input.aspect_ratio
      : "16:9",
    resolution: (input.resolution as string) || "720p",
    duration_seconds: (input.duration_seconds as number) || 8,
    include_audio: input.include_audio !== false,
  };
}
