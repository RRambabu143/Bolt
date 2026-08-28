import { LayoutTemplate, X } from "lucide-react";
import { PROMPT_TEMPLATES } from "../config/templates";
import type { GenerationType, PromptTemplate } from "../types";
export default function PromptTemplates({
  type,
  onChoose,
  onClose,
}: {
  type: GenerationType;
  onChoose: (t: PromptTemplate) => void;
  onClose: () => void;
}) {
  const items = PROMPT_TEMPLATES.filter((t) => t.type === type);
  return (
    <div
      className="modalBackdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <header>
          <span>
            <LayoutTemplate />
            <b>Prompt templates</b>
          </span>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <p>
          Start with a proven structure, then replace the bracketed details.
        </p>
        <div className="templateGrid">
          {items.map((t) => (
            <button key={t.id} onClick={() => onChoose(t)}>
              <span className="templateIcon">{t.name[0]}</span>
              <b>{t.name}</b>
              <small>{t.description}</small>
              <footer>
                {t.tags.map((tag) => (
                  <i key={tag}>{tag}</i>
                ))}
              </footer>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
