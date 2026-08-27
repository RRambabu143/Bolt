import { SlidersHorizontal, Volume2 } from "lucide-react";
import {
  ASPECT_RATIOS,
  TEXT_FORMATS,
  TONES,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
} from "../config/models";
import type { GenerationKind, GenerationSettings } from "../types";
export default function SettingsPanel({
  kind,
  value,
  onChange,
}: {
  kind: GenerationKind;
  value: GenerationSettings;
  onChange: (x: GenerationSettings) => void;
}) {
  const set = <K extends keyof GenerationSettings>(
    key: K,
    next: GenerationSettings[K],
  ) => onChange({ ...value, [key]: next });
  return (
    <div className="settings">
      <div className="settingsTitle">
        <SlidersHorizontal />
        Generation settings
      </div>
      {kind === "text" ? (
        <>
          <label>
            Output format
            <select
              value={value.format}
              onChange={(e) => set("format", e.target.value)}
            >
              {TEXT_FORMATS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Tone
            <select
              value={value.tone}
              onChange={(e) => set("tone", e.target.value)}
            >
              {TONES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Creativity <span>{value.creativity}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={value.creativity}
              onChange={(e) => set("creativity", Number(e.target.value))}
            />
          </label>
        </>
      ) : (
        <>
          <label>
            Aspect ratio
            <div className="segmented">
              {ASPECT_RATIOS.filter(
                (x) => kind === "image" || ["16:9", "9:16"].includes(x.value),
              ).map((x) => (
                <button
                  className={value.aspect_ratio === x.value ? "active" : ""}
                  onClick={() => set("aspect_ratio", x.value)}
                  key={x.value}
                >
                  {x.detail}
                </button>
              ))}
            </div>
          </label>
          {kind === "image" && (
            <>
              <label>
                Negative prompt
                <textarea
                  rows={2}
                  value={value.negative_prompt || ""}
                  onChange={(e) => set("negative_prompt", e.target.value)}
                  placeholder="Elements to avoid…"
                />
              </label>
              <label>
                Seed
                <input
                  type="number"
                  value={value.seed || ""}
                  onChange={(e) =>
                    set(
                      "seed",
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  placeholder="Random"
                />
              </label>
            </>
          )}
          {kind === "video" && (
            <>
              <label>
                Duration
                <div className="segmented">
                  {VIDEO_DURATIONS.map((x) => (
                    <button
                      className={value.duration_seconds === x ? "active" : ""}
                      onClick={() => set("duration_seconds", x)}
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
                      className={value.resolution === x ? "active" : ""}
                      onClick={() => set("resolution", x)}
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
                  checked={value.include_audio}
                  onChange={(e) => set("include_audio", e.target.checked)}
                />
              </label>
            </>
          )}
        </>
      )}
    </div>
  );
}
