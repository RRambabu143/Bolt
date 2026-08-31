import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Image,
  LayoutTemplate,
  LoaderCircle,
  Sparkles,
  WandSparkles,
  Video,
} from "lucide-react";
import { enhancePrompt, generate, pollVideoStatus } from "../lib/api";
import { MODEL_DISPLAY } from "../config/models";
import type {
  Generation,
  GenerationType,
  PromptTemplate,
} from "../types";
import { GENERATION_COSTS } from "../types";
import PromptTemplates from "../components/PromptTemplates";
import SettingsPanel, {
  type SettingsValue,
} from "../components/SettingsPanel";
import ResultViewer from "../components/ResultViewer";
import { useVideoPolling } from "../hooks/useVideoPolling";
import { useBalance } from "../components/UsageMeter";

const MODES = [
  {
    type: "text" as const,
    label: "Write",
    sub: "Ideas into words",
    icon: FileText,
  },
  {
    type: "image" as const,
    label: "Imagine",
    sub: "Words into visuals",
    icon: Image,
  },
  {
    type: "video" as const,
    label: "Direct",
    sub: "Stories into motion",
    icon: Video,
  },
];

const defaultSettings: Record<GenerationType, SettingsValue> = {
  text: { tone: "Professional", format: "Article", creativity: 60 },
  image: {
    provider: "google",
    model: "gemini-3.1-flash-image",
    aspect_ratio: "1:1",
    n: 1,
    quality: "standard",
  },
  video: {
    model: "veo-3.1-lite-generate-preview",
    aspect_ratio: "16:9",
    duration_seconds: 8,
    resolution: "720p",
    include_audio: true,
  },
};

export default function Studio() {
  const [type, setType] = useState<GenerationType>("text");
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<SettingsValue>(defaultSettings.text);
  const [result, setResult] = useState<Generation | null>(null);
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [templates, setTemplates] = useState(false);
  const { refresh: refreshBalance } = useBalance();

  useEffect(() => {
    setSettings(defaultSettings[type]);
    setResult(null);
  }, [type]);

  useVideoPolling(result, setResult, (m) => toast.error(m));

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        create();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prompt, settings, type, busy]);

  async function create() {
    if (prompt.trim().length < 3)
      return toast.error("Describe what you want to create");
    setBusy(true);
    setResult(null);
    try {
      const result = await generate({
        type,
        prompt: prompt.trim(),
        settings: settings as unknown as Record<string, unknown>,
      });
      setResult(result.row);
      const cost = GENERATION_COSTS[type];
      const chipWord = cost === 1 ? "Mind Chip" : "Mind Chips";
      if (result.balance !== null) {
        toast.success(`${cost} ${chipWord} used • ${result.balance} Mind Chips remaining`);
      } else {
        toast.success(type === "video" ? "Veo job started" : "Creation complete");
      }
      refreshBalance();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      console.error("[MindMesh] Generation error:", e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function improve() {
    if (prompt.trim().length < 3)
      return toast.error("Write a short idea first");
    setEnhancing(true);
    try {
      setPrompt(await enhancePrompt(prompt, type));
      toast.success("Prompt enhanced");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not enhance prompt";
      console.error("[MindMesh] Enhance error:", e);
      toast.error(msg);
    } finally {
      setEnhancing(false);
    }
  }

  async function check() {
    if (!result) return;
    setBusy(true);
    try {
      setResult(await pollVideoStatus(result.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status check failed");
    } finally {
      setBusy(false);
    }
  }

  function choose(t: PromptTemplate) {
    setPrompt(t.prompt);
    if (t.settings) {
      setSettings({ ...defaultSettings[type], ...t.settings } as SettingsValue);
    }
    setTemplates(false);
  }

  return (
    <div className="page">
      <div className="pageIntro">
        <span className="eyebrow">
          <Sparkles /> CREATE SOMETHING EXTRAORDINARY
        </span>
        <h1>What will you make today?</h1>
        <p>
          Choose a medium, describe your vision, and let the studio do the rest.
        </p>
      </div>
      <div className="modeGrid">
        {MODES.map((m) => (
          <button
            key={m.type}
            className={type === m.type ? "active" : ""}
            onClick={() => setType(m.type)}
          >
            <m.icon />
            <span>
              <b>{m.label}</b>
              <small>{m.sub}</small>
            </span>
            <i>{MODEL_DISPLAY[m.type].name}</i>
          </button>
        ))}
      </div>
      <div className="studioGrid">
        <section className="promptPanel">
          <div className="panelHeader">
            <span>
              <b>{type[0].toUpperCase() + type.slice(1)} generation</b>
              <small>
                {MODEL_DISPLAY[type].provider} · {MODEL_DISPLAY[type].name}
              </small>
            </span>
            <button onClick={() => setTemplates(true)}>
              <LayoutTemplate />
              Templates
            </button>
          </div>
          <div className="promptBox">
            <textarea
              maxLength={4000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your idea with subject, mood, composition, style, camera, lighting, motion and sound…"
            />
            <footer>
              <button onClick={improve} disabled={enhancing}>
                {enhancing ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <WandSparkles />
                )}
                {enhancing ? "Enhancing…" : "Enhance prompt"}
              </button>
              <span>{prompt.length}/4000</span>
            </footer>
          </div>
          <SettingsPanel
            type={type}
            value={settings}
            onChange={setSettings}
          />
          <button
            className="primary generateButton"
            onClick={create}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" /> : <Sparkles />}
            {busy ? "Creating…" : `Generate ${type}`}
            <kbd>{GENERATION_COSTS[type]} {GENERATION_COSTS[type] === 1 ? "Mind Chip" : "Mind Chips"}</kbd>
          </button>
        </section>
        <section className="outputPanel">
          <ResultViewer type={type} row={result} onCheck={check} busy={busy} />
        </section>
      </div>
      {templates && (
        <PromptTemplates
          type={type}
          onChoose={choose}
          onClose={() => setTemplates(false)}
        />
      )}
    </div>
  );
}
