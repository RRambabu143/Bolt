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
        {row.type === "image" && row.result_url ? (
          <img src={row.result_url} alt={row.prompt} />
        ) : row.type === "video" && row.result_url ? (
          <video src={row.result_url} />
        ) : row.type === "text" ? (
          <FileText />
        ) : row.type === "image" ? (
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
          {row.type.toUpperCase()} · {new Date(row.created_at).toLocaleString()}
        </small>
        <p>{row.prompt}</p>
        <footer>
          <span>{row.model}</span>
          <div>
            {row.type === "video" && row.status === "processing" && (
              <button title="Refresh" onClick={onRefresh}>
                <RefreshCw />
              </button>
            )}
            {row.result_url && (
              <a
                title="Open"
                href={row.result_url}
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
