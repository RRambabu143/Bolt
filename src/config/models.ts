import type { GenerationType } from "../types";

export const MODEL_DISPLAY: Record<
  GenerationType,
  { name: string; provider: string; detail: string }
> = {
  text: {
    name: "GPT-5.6",
    provider: "OpenAI",
    detail: "Advanced writing and reasoning",
  },
  image: {
    name: "GPT-Image-2",
    provider: "OpenAI / Google",
    detail: "High-quality image generation",
  },
  video: {
    name: "Veo 3.1 Lite",
    provider: "Google",
    detail: "Cinematic video with native audio",
  },
};

export const ASPECT_RATIOS = [
  { value: "1:1", label: "Square", detail: "1:1" },
  { value: "16:9", label: "Landscape", detail: "16:9" },
  { value: "9:16", label: "Portrait", detail: "9:16" },
  { value: "4:3", label: "Classic", detail: "4:3" },
  { value: "3:4", label: "Portrait", detail: "3:4" },
] as const;

export const TEXT_FORMATS = [
  "Article",
  "Social post",
  "Video script",
  "Marketing copy",
  "Email",
  "Product description",
];

export const TONES = [
  "Professional",
  "Cinematic",
  "Friendly",
  "Persuasive",
  "Educational",
  "Playful",
  "Inspirational",
];

export const VIDEO_RESOLUTIONS = ["720p", "1080p", "4k"] as const;
export const VIDEO_DURATIONS = [4, 6, 8] as const;

export const IMAGE_PROVIDERS = [
  { value: "openai" as const, label: "OpenAI GPT-Image-2", model: "gpt-image-2" },
  { value: "google" as const, label: "Google Gemini Flash", model: "gemini-3.1-flash-image" },
];

export const IMAGE_QUALITIES = ["standard", "hd"] as const;
