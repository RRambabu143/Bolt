export type GenerationKind = "text" | "image" | "video";
export type GenerationStatus = "queued" | "processing" | "completed" | "failed";
export type Provider = "openai" | "google" | "demo";
export interface GenerationSettings {
  aspect_ratio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
  resolution?: "720p" | "1080p" | "4k";
  duration_seconds?: 4 | 6 | 8;
  tone?: string;
  format?: string;
  creativity?: number;
  negative_prompt?: string;
  seed?: number;
  include_audio?: boolean;
  reference_image_url?: string;
}
export interface Generation {
  id: string;
  user_id: string;
  kind: GenerationKind;
  provider: Provider;
  prompt: string;
  enhanced_prompt: string | null;
  model: string;
  status: GenerationStatus;
  output_text: string | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  storage_path: string | null;
  provider_job_id: string | null;
  settings: GenerationSettings;
  metadata: Record<string, unknown>;
  error: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}
export interface UsageSummary {
  text: number;
  image: number;
  video: number;
  total: number;
  daily_limit: number;
  remaining: number;
}
export interface GenerateRequest {
  kind: GenerationKind;
  prompt: string;
  settings: GenerationSettings;
  use_enhanced_prompt?: boolean;
}
export interface PromptTemplate {
  id: string;
  kind: GenerationKind;
  name: string;
  description: string;
  prompt: string;
  tags: string[];
  settings?: GenerationSettings;
}
export type HistoryFilter = "all" | GenerationKind | "favorites";
