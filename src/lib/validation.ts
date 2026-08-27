import type { GenerationKind, GenerationSettings } from "../types";
export function validatePrompt(prompt: string) {
  const value = prompt.trim();
  if (value.length < 3) return "Prompt must contain at least 3 characters.";
  if (value.length > 4000) return "Prompt cannot exceed 4,000 characters.";
  return null;
}
export function normalizeSettings(
  kind: GenerationKind,
  input: GenerationSettings,
): GenerationSettings {
  if (kind === "text")
    return {
      tone: input.tone || "Professional",
      format: input.format || "Article",
      creativity: Math.max(0, Math.min(100, input.creativity ?? 60)),
    };
  if (kind === "image")
    return {
      aspect_ratio: input.aspect_ratio || "1:1",
      negative_prompt: (input.negative_prompt || "").slice(0, 500),
      seed: input.seed,
    };
  return {
    aspect_ratio: ["16:9", "9:16"].includes(input.aspect_ratio || "")
      ? input.aspect_ratio
      : "16:9",
    resolution: input.resolution || "720p",
    duration_seconds: input.duration_seconds || 8,
    include_audio: input.include_audio !== false,
    reference_image_url: input.reference_image_url,
  };
}
