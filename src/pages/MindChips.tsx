import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Brain, RefreshCw } from "lucide-react";
import { demoMode } from "../lib/api";
import { demo } from "../lib/demo";
import { getMindChipsBalance, getMindChipsTransactions } from "../lib/api";
import type { CreditTransaction } from "../types";

export default function MindChips() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (demoMode) {
        setBalance(demo.mindChipsBalance());
        setTransactions(demo.mindChipsTransactions());
      } else {
        const [bal, txns] = await Promise.all([
          getMindChipsBalance(),
          getMindChipsTransactions(),
        ]);
        setBalance(bal);
        setTransactions(txns);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load Mind Chips";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalUsed = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalAdded = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="page">
      <div className="historyHead">
        <div>
          <span className="eyebrow">
            <Brain /> YOUR MIND CHIPS
          </span>
          <h1>Mind Chips</h1>
          <p>Manage your creative balance and view transaction history.</p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="emptyState">
          <RefreshCw className="spin" />
        </div>
      ) : (
        <>
          <div className="chipsSummary">
            <div className="chipsCard">
              <span className="chipsLabel">Mind Chips Balance</span>
              <b>{balance ?? 0}</b>
            </div>
            <div className="chipsCard">
              <span className="chipsLabel">Mind Chips Used</span>
              <b>{totalUsed}</b>
            </div>
            <div className="chipsCard">
              <span className="chipsLabel">Mind Chips Added</span>
              <b>{totalAdded}</b>
            </div>
          </div>

          <div className="txnSection">
            <h2>Transaction History</h2>
            {transactions.length === 0 ? (
              <div className="emptyState">
                <h3>No transactions yet</h3>
                <p>Generate content to see your Mind Chips activity here.</p>
              </div>
            ) : (
              <div className="txnList">
                {transactions.map((t) => (
                  <div key={t.id} className="txnRow">
                    <span className={`txnAmount ${t.amount > 0 ? "positive" : "negative"}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount} {Math.abs(t.amount) === 1 ? "Mind Chip" : "Mind Chips"}
                    </span>
                    <span className="txnDesc">
                      {t.description}
                      {t.generation_type && (
                        <small> · {t.generation_type}</small>
                      )}
                    </span>
                    <span className="txnDate">
                      {new Date(t.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
