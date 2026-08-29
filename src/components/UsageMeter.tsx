import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { demoMode, getMindChipsBalance } from "../lib/api";
import { demo } from "../lib/demo";

interface BalanceContextValue {
  balance: number | null;
  refresh: () => void;
}

const BalanceContext = createContext<BalanceContextValue>({
  balance: null,
  refresh: () => {},
});

export function useBalance() {
  return useContext(BalanceContext);
}

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);

  const load = useCallback(() => {
    if (demoMode) {
      setBalance(demo.mindChipsBalance());
      return;
    }
    getMindChipsBalance()
      .then(setBalance)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <BalanceContext.Provider value={{ balance, refresh: load }}>
      {children}
    </BalanceContext.Provider>
  );
}

export default function UsageMeter() {
  const { balance } = useBalance();
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

export function HeaderBalance() {
  const { balance } = useBalance();
  if (balance === null) return null;

  return (
    <div className="headerBalance" title="Your Mind Chips balance">
      <Brain />
      <b>{balance.toLocaleString()}</b>
      <span>Mind Chips</span>
    </div>
  );
}
