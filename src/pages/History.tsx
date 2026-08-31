import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Copy, Download, ExternalLink, FileText, Heart, Image, Play, RefreshCw, Search, Trash2, Video, X } from "lucide-react";
import {
  deleteGeneration,
  exportText,
  listGenerations,
  pollVideoStatus,
  setFavorite,
} from "../lib/api";
import type { Generation, HistoryFilter } from "../types";
import GenerationCard from "../components/GenerationCard";

const FILTERS: [HistoryFilter, string][] = [
  ["all", "All"],
  ["text", "Text"],
  ["image", "Images"],
  ["video", "Videos"],
  ["favorites", "Favorites"],
];

export default function History() {
  const [rows, setRows] = useState<Generation[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Generation | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listGenerations(filter, search));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load history";
      console.error("[MindMesh] History load error:", e);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Permanently delete this generation and its cloud asset?"))
      return;
    try {
      await deleteGeneration(id);
      setRows((x) => x.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("Generation deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function favorite(row: Generation) {
    try {
      const next = await setFavorite(row.id, !row.favorite);
      setRows((x) => x.map((r) => (r.id === row.id ? next : r)));
      if (selected?.id === row.id) setSelected(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function refresh(row: Generation) {
    try {
      const next = await pollVideoStatus(row.id);
      setRows((x) => x.map((r) => (r.id === row.id ? next : r)));
      if (selected?.id === row.id) setSelected(next);
      toast.success("Status: " + next.status);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    }
  }

  async function copyText() {
    if (!selected?.result_text) return;
    await navigator.clipboard.writeText(selected.result_text);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="page">
      <div className="historyHead">
        <div>
          <span className="eyebrow">✦ YOUR CREATIVE ARCHIVE</span>
          <h1>Generation history</h1>
          <p>Every idea, image, and scene—private and easy to find.</p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw />
          Refresh
        </button>
      </div>
      <div className="historyTools">
        <div className="filters">
          {FILTERS.map(([v, l]) => (
            <button
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
              key={v}
            >
              {l}
            </button>
          ))}
        </div>
        <label>
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts…"
          />
        </label>
      </div>
      {loading ? (
        <div className="emptyState">
          <Loader />
        </div>
      ) : rows.length ? (
        <div className="historyGrid">
          {rows.map((row) => (
            <GenerationCard
              key={row.id}
              row={row}
              onFavorite={() => favorite(row)}
              onDelete={() => remove(row.id)}
              onRefresh={() => refresh(row)}
              onOpen={() => setSelected(row)}
            />
          ))}
        </div>
      ) : (
        <div className="emptyState">
          <h3>No creations found</h3>
          <p>Try a different filter or create something new.</p>
        </div>
      )}

      {selected && (
        <div className="modalBackdrop" onClick={() => setSelected(null)}>
          <div className="detailModal" onClick={(e) => e.stopPropagation()}>
            <header>
              <span>
                {selected.type === "text" ? <FileText /> : selected.type === "image" ? <Image /> : <Video />}
                <b>{selected.type.toUpperCase()}</b>
                <small>{new Date(selected.created_at).toLocaleString()}</small>
              </span>
              <button onClick={() => setSelected(null)}>
                <X />
              </button>
            </header>

            <div className="detailPrompt">
              <small>PROMPT</small>
              <p>{selected.prompt}</p>
            </div>

            <div className="detailContent">
              {selected.status !== "completed" ? (
                <div className="detailProcessing">
                  {selected.status === "processing" ? <RefreshCw className="spin" /> : <FileText />}
                  <p>{selected.status === "processing" ? "Still rendering…" : selected.error_message || "Generation did not complete."}</p>
                </div>
              ) : selected.type === "text" ? (
                <article>{selected.result_text}</article>
              ) : selected.type === "image" ? (
                <div className="detailImageGrid">
                  {((selected.metadata?.all_urls as string[] | undefined) || (selected.result_url ? [selected.result_url] : [])).map((url, i) => (
                    <img key={i} src={url} alt={`${selected.prompt} ${i + 1}`} />
                  ))}
                </div>
              ) : (
                <video controls autoPlay={false} src={selected.result_url!} />
              )}
            </div>

            <footer>
              <span className="detailModel">{selected.model}</span>
              <div className="detailActions">
                <button
                  className={"favorite " + (selected.favorite ? "active" : "")}
                  onClick={() => favorite(selected)}
                >
                  <Heart />
                </button>
                {selected.type === "text" && selected.result_text && (
                  <>
                    <button className="iconButton" onClick={copyText}>
                      {copied ? <Check /> : <Copy />}
                    </button>
                    <button className="secondary" onClick={() => exportText(selected)}>
                      <Download />
                      Export
                    </button>
                  </>
                )}
                {selected.result_url && selected.type !== "text" && (
                  <a className="secondary" href={selected.result_url} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Open
                  </a>
                )}
                {selected.type === "video" && selected.status === "processing" && (
                  <button className="secondary" onClick={() => refresh(selected)}>
                    <RefreshCw />
                    Check
                  </button>
                )}
                <button className="iconButton" onClick={() => remove(selected.id)}>
                  <Trash2 />
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function Loader() {
  return <RefreshCw className="spin" />;
}
