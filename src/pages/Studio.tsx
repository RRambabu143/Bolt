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
import { enhancePrompt, generate, pollVideo } from "../lib/api";
import { MODEL_DISPLAY } from "../config/models";
import type {
  Generation,
  GenerationKind,
  GenerationSettings,
  PromptTemplate,
} from "../types";
import PromptTemplates from "../components/PromptTemplates";
import SettingsPanel from "../components/SettingsPanel";
import ResultViewer from "../components/ResultViewer";
import { useVideoPolling } from "../hooks/useVideoPolling";
const MODES = [
  {
    kind: "text" as const,
    label: "Write",
    sub: "Ideas into words",
    icon: FileText,
  },
  {
    kind: "image" as const,
    label: "Imagine",
    sub: "Words into visuals",
    icon: Image,
  },
  {
    kind: "video" as const,
    label: "Direct",
    sub: "Stories into motion",
    icon: Video,
  },
];
const defaults: Record<GenerationKind, GenerationSettings> = {
  text: { tone: "Professional", format: "Article", creativity: 60 },
  image: { aspect_ratio: "1:1", negative_prompt: "" },
  video: {
    aspect_ratio: "16:9",
    resolution: "720p",
    duration_seconds: 8,
    include_audio: true,
  },
};
export default function Studio() {
  const [kind, setKind] = useState<GenerationKind>("text"),
    [prompt, setPrompt] = useState(""),
    [settings, setSettings] = useState(defaults.text),
    [result, setResult] = useState<Generation | null>(null),
    [busy, setBusy] = useState(false),
    [enhancing, setEnhancing] = useState(false),
    [templates, setTemplates] = useState(false);
  useEffect(() => {
    setSettings(defaults[kind]);
    setResult(null);
  }, [kind]);
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
  }, [prompt, settings, kind, busy]);
  async function create() {
    if (prompt.trim().length < 3)
      return toast.error("Describe what you want to create");
    setBusy(true);
    setResult(null);
    try {
      const row = await generate({ kind, prompt: prompt.trim(), settings });
      setResult(row);
      toast.success(kind === "video" ? "Veo job started" : "Creation complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }
  async function improve() {
    if (prompt.trim().length < 3)
      return toast.error("Write a short idea first");
    setEnhancing(true);
    try {
      setPrompt(await enhancePrompt(prompt, kind));
      toast.success("Prompt enhanced");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enhance prompt");
    } finally {
      setEnhancing(false);
    }
  }
  async function check() {
    if (!result) return;
    setBusy(true);
    try {
      setResult(await pollVideo(result.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status check failed");
    } finally {
      setBusy(false);
    }
  }
  function choose(t: PromptTemplate) {
    setPrompt(t.prompt);
    setSettings({ ...defaults[kind], ...t.settings });
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
            key={m.kind}
            className={kind === m.kind ? "active" : ""}
            onClick={() => setKind(m.kind)}
          >
            <m.icon />
            <span>
              <b>{m.label}</b>
              <small>{m.sub}</small>
            </span>
            <i>{MODEL_DISPLAY[m.kind].name}</i>
          </button>
        ))}
      </div>
      <div className="studioGrid">
        <section className="promptPanel">
          <div className="panelHeader">
            <span>
              <b>{kind[0].toUpperCase() + kind.slice(1)} generation</b>
              <small>
                {MODEL_DISPLAY[kind].provider} · {MODEL_DISPLAY[kind].name}
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
          <SettingsPanel kind={kind} value={settings} onChange={setSettings} />
          <button
            className="primary generateButton"
            onClick={create}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" /> : <Sparkles />}
            {busy ? "Creating…" : "Generate " + kind}
            <kbd>⌘ ↵</kbd>
          </button>
        </section>
        <section className="outputPanel">
          <ResultViewer kind={kind} row={result} onCheck={check} busy={busy} />
        </section>
      </div>
      {templates && (
        <PromptTemplates
          kind={kind}
          onChoose={choose}
          onClose={() => setTemplates(false)}
        />
      )}
    </div>
  );
}
