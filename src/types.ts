export type GenerationType = "text" | "image" | "video";
export type GenerationStatus = "queued" | "processing" | "completed" | "failed";
export type Provider = "cloudflare" | "anthropic" | "demo";

export interface TextSettings {
  tone: string;
  format: string;
  creativity: number;
}

export interface ImageSettings {
  provider: "cloudflare";
  model: string;
  aspect_ratio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  n: number;
  quality: "standard" | "hd";
}

export interface VideoSettings {
  model: string;
  aspect_ratio: "16:9" | "9:16";
  duration_seconds: 4 | 6 | 8 | 10;
  resolution: "720p" | "1080p" | "4k";
  include_audio: boolean;
}

export type GenerationSettings = TextSettings | ImageSettings | VideoSettings;

export interface Generation {
  id: string;
  user_id: string;
  type: GenerationType;
  prompt: string;
  provider: string | null;
  model: string | null;
  status: GenerationStatus;
  result_url: string | null;
  result_text: string | null;
  metadata: Record<string, unknown>;
  error_message: string | null;
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

export interface MindChipsBalance {
  balance: number;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  type: "bonus" | "generation" | "refund";
  generation_type: string | null;
  created_at: string;
}

export const GENERATION_COSTS: Record<GenerationType, number> = {
  text: 1,
  image: 10,
  video: 50,
};

export interface GenerateRequest {
  type: GenerationType;
  prompt: string;
  settings: Record<string, unknown>;
}

export interface PromptTemplate {
  id: string;
  type: GenerationType;
  name: string;
  description: string;
  prompt: string;
  tags: string[];
  settings?: Record<string, unknown>;
}

export type HistoryFilter = "all" | GenerationType | "favorites";
