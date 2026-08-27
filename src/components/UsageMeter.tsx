import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { getUsage } from "../lib/api";
import type { UsageSummary } from "../types";
export default function UsageMeter() {
  const [u, setU] = useState<UsageSummary | null>(null);
  useEffect(() => {
    getUsage()
      .then(setU)
      .catch(() => {});
  }, []);
  if (!u) return null;
  const pct = Math.min(100, Math.round((u.total / u.daily_limit) * 100));
  return (
    <div className="usage">
      <span>
        <Zap />
        <b>Daily usage</b>
        <small>{u.remaining} generations remaining</small>
      </span>
      <div className="usageBar">
        <i style={{ width: pct + "%" }} />
      </div>
      <footer>
        <span>Text {u.text}</span>
        <span>Image {u.image}</span>
        <span>Video {u.video}</span>
      </footer>
    </div>
  );
}
