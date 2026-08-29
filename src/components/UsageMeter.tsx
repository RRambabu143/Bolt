import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { getMindChipsBalance } from "../lib/api";
import { demoMode } from "../lib/api";
import { demo } from "../lib/demo";

export default function UsageMeter() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (demoMode) {
      setBalance(demo.mindChipsBalance());
      return;
    }
    getMindChipsBalance()
      .then(setBalance)
      .catch(() => {});
  }, []);

  if (balance === null) return null;

  return (
    <div className="usage mindChips">
      <span>
        <Brain />
        <b>Mind Chips</b>
        <small>{balance} Mind Chips Balance</small>
      </span>
      <div className="chipsBar">
        <i style={{ width: Math.min(100, (balance / 500) * 100) + "%" }} />
      </div>
      <footer>
        <span>Text 1 Chip</span>
        <span>Image 10 Chips</span>
        <span>Video 50 Chips</span>
      </footer>
    </div>
  );
}

export function useBalanceRefresher() {
  const [refreshKey, setRefreshKey] = useState(0);
  return {
    refreshKey,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
