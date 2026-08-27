import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RefreshCw, Search } from "lucide-react";
import {
  deleteGeneration,
  listGenerations,
  pollVideo,
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
  const [rows, setRows] = useState<Generation[]>([]),
    [filter, setFilter] = useState<HistoryFilter>("all"),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listGenerations(filter, search));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load history");
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
      toast.success("Generation deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }
  async function favorite(row: Generation) {
    try {
      const next = await setFavorite(row.id, !row.favorite);
      setRows((x) => x.map((r) => (r.id === row.id ? next : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }
  async function refresh(row: Generation) {
    try {
      const next = await pollVideo(row.id);
      setRows((x) => x.map((r) => (r.id === row.id ? next : r)));
      toast.success("Status: " + next.status);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    }
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
            />
          ))}
        </div>
      ) : (
        <div className="emptyState">
          <h3>No creations found</h3>
          <p>Try a different filter or create something new.</p>
        </div>
      )}
    </div>
  );
}
function Loader() {
  return <RefreshCw className="spin" />;
}
