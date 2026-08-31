import { SlidersHorizontal, Volume2 } from "lucide-react";
import {
  ASPECT_RATIOS,
  IMAGE_PROVIDERS,
  IMAGE_QUALITIES,
  TEXT_FORMATS,
  TONES,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
} from "../config/models";
import type { GenerationType } from "../types";

export interface TextSettingsValue {
  tone: string;
  format: string;
  creativity: number;
}
export interface ImageSettingsValue {
  provider: "cloudflare";
  model: string;
  aspect_ratio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  n: number;
  quality: "standard" | "hd";
}
export interface VideoSettingsValue {
  model: string;
  aspect_ratio: "16:9" | "9:16";
  duration_seconds: 4 | 6 | 8 | 10;
  resolution: "720p" | "1080p" | "4k";
  include_audio: boolean;
}
export type SettingsValue = TextSettingsValue | ImageSettingsValue | VideoSettingsValue;

export default function SettingsPanel({
  type,
  value,
  onChange,
}: {
  type: GenerationType;
  value: SettingsValue;
  onChange: (x: SettingsValue) => void;
}) {
  const patch = (partial: Record<string, unknown>) =>
    onChange({ ...value, ...partial } as SettingsValue);

  return (
    <div className="settings">
      <div className="settingsTitle">
        <SlidersHorizontal />
        Generation settings
      </div>

      {type === "text" && (
        <>
          <label>
            Output format
            <select
              value={(value as TextSettingsValue).format}
              onChange={(e) => patch({ format: e.target.value })}
            >
              {TEXT_FORMATS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Tone
            <select
              value={(value as TextSettingsValue).tone}
              onChange={(e) => patch({ tone: e.target.value })}
            >
              {TONES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Creativity <span>{(value as TextSettingsValue).creativity}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={(value as TextSettingsValue).creativity}
              onChange={(e) => patch({ creativity: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      {type === "image" && (
        <>
          <label>
            Provider
            <select
              value={(value as ImageSettingsValue).provider}
              onChange={(e) => {
                const provider = e.target.value as "cloudflare";
                const found = IMAGE_PROVIDERS.find((p) => p.value === provider);
                patch({ provider, model: found?.model || "@cf/black-forest-labs/flux-1-schnell" });
              }}
            >
              {IMAGE_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <select
              value={(value as ImageSettingsValue).model}
              onChange={(e) => patch({ model: e.target.value })}
            >
              <option value={(value as ImageSettingsValue).model}>
                {(value as ImageSettingsValue).model}
              </option>
            </select>
          </label>
          <p className="cloudflareNote">FLUX 1 Schnell generates one 1024×1024 image per request. Aspect ratio, count, and quality settings do not apply.</p>
        </>
      )}

      {type === "video" && (
        <>
          <label>
            Model
            <select
              value={(value as VideoSettingsValue).model}
              onChange={(e) => patch({ model: e.target.value })}
            >
              <option value="veo-3.1-lite-generate-preview">Veo 3.1 Lite</option>
              <option value="veo-3.1-generate-preview">Veo 3.1 Pro</option>
            </select>
          </label>
          <label>
            Aspect ratio
            <div className="segmented">
              {ASPECT_RATIOS.filter((x) =>
                ["16:9", "9:16"].includes(x.value),
              ).map((x) => (
                <button
                  className={
                    (value as VideoSettingsValue).aspect_ratio === x.value
                      ? "active"
                      : ""
                  }
                  onClick={() => patch({ aspect_ratio: x.value })}
                  key={x.value}
                >
                  {x.detail}
                </button>
              ))}
            </div>
          </label>
          <label>
            Duration
            <div className="segmented">
              {VIDEO_DURATIONS.map((x) => (
                <button
                  className={
                    (value as VideoSettingsValue).duration_seconds === x
                      ? "active"
                      : ""
                  }
                  onClick={() => patch({ duration_seconds: x })}
                  key={x}
                >
                  {x}s
                </button>
              ))}
            </div>
          </label>
          <label>
            Resolution
            <div className="segmented">
              {VIDEO_RESOLUTIONS.map((x) => (
                <button
                  className={
                    (value as VideoSettingsValue).resolution === x
                      ? "active"
                      : ""
                  }
                  onClick={() => patch({ resolution: x })}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </div>
          </label>
          <label className="switchLine">
            <span>
              <Volume2 />
              Native audio
            </span>
            <input
              type="checkbox"
              checked={(value as VideoSettingsValue).include_audio}
              onChange={(e) => patch({ include_audio: e.target.checked })}
            />
          </label>
        </>
      )}
    </div>
  );
}
