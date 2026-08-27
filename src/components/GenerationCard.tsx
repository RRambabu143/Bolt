import {
  Download,
  FileText,
  Heart,
  Image,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react";
import type { Generation } from "../types";
export default function GenerationCard({
  row,
  onFavorite,
  onDelete,
  onRefresh,
}: {
  row: Generation;
  onFavorite: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  return (
    <article className="generationCard">
      <div className="cardVisual">
        {row.kind === "image" && row.asset_url ? (
          <img src={row.asset_url} alt={row.prompt} />
        ) : row.kind === "video" && row.asset_url ? (
          <video src={row.asset_url} />
        ) : row.kind === "text" ? (
          <FileText />
        ) : row.kind === "image" ? (
          <Image />
        ) : row.status === "processing" ? (
          <LoaderCircle className="spin" />
        ) : (
          <Video />
        )}
        <span className={"status " + row.status}>{row.status}</span>
        <button
          className={"favorite " + (row.favorite ? "active" : "")}
          onClick={onFavorite}
        >
          <Heart />
        </button>
      </div>
      <div className="cardContent">
        <small>
          {row.kind.toUpperCase()} · {new Date(row.created_at).toLocaleString()}
        </small>
        <p>{row.prompt}</p>
        <footer>
          <span>{row.model}</span>
          <div>
            {row.kind === "video" && row.status === "processing" && (
              <button title="Refresh" onClick={onRefresh}>
                <RefreshCw />
              </button>
            )}
            {row.asset_url && (
              <a
                title="Open"
                href={row.asset_url}
                target="_blank"
                rel="noreferrer"
              >
                <Download />
              </a>
            )}
            <button title="Delete" onClick={onDelete}>
              <Trash2 />
            </button>
          </div>
        </footer>
      </div>
    </article>
  );
}
