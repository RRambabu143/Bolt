import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Play,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { exportText } from "../lib/api";
import type { Generation, GenerationType } from "../types";

export default function ResultViewer({
  type,
  row,
  onCheck,
  busy,
}: {
  type: GenerationType;
  row: Generation | null;
  onCheck: () => void;
  busy: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(row?.result_text || "");
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  }

  if (!row)
    return (
      <div className="emptyResult">
        <div>{type === "text" ? <FileText /> : <Play />}</div>
        <h3>Your creation appears here</h3>
        <p>Enter a prompt, adjust the settings, and generate.</p>
      </div>
    );

  if (row.status === "failed")
    return (
      <div className="emptyResult error">
        <h3>Generation failed</h3>
        <p>{row.error_message || "The provider did not complete this request."}</p>
      </div>
    );

  if (row.status !== "completed")
    return (
      <div className="emptyResult">
        <LoaderCircle className="spin heroSpinner" />
        <h3>Veo is rendering your scene</h3>
        <p>
          This can take several minutes. The job is saved, and this page checks
          automatically every 10 seconds.
        </p>
        <button className="secondary" onClick={onCheck} disabled={busy}>
          <RefreshCw />
          Check now
        </button>
      </div>
    );

  const allUrls = (row.metadata?.all_urls as string[] | undefined) || (row.result_url ? [row.result_url] : []);

  return (
    <div className="resultViewer">
      <div className="resultCanvas">
        {row.type === "text" ? (
          <article>{row.result_text}</article>
        ) : row.type === "image" ? (
          <div className="imageGrid">
            {allUrls.map((url, i) => (
              <img key={i} src={url} alt={`${row.prompt} ${i + 1}`} />
            ))}
          </div>
        ) : (
          <video controls autoPlay={false} src={row.result_url!} />
        )}
      </div>
      <footer>
        <span>
          <i>
            <Check />
          </i>
          <b>Generation complete</b>
          <small>{row.model}</small>
        </span>
        <div>
          {row.type === "text" ? (
            <>
              <button className="iconButton" onClick={copy}>
                {copied ? <Check /> : <Copy />}
              </button>
              <button className="secondary" onClick={() => exportText(row)}>
                <Download />
                Export
              </button>
            </>
          ) : (
            <a
              className="secondary"
              href={row.result_url!}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink />
              Open asset
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
