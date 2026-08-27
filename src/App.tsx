import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, configured } from "./lib/supabase";
import { demoMode } from "./lib/api";
import Auth from "./pages/Auth";
import Studio from "./pages/Studio";
import History from "./pages/History";
import Shell from "./components/Shell";
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(demoMode);
  useEffect(() => {
    if (demoMode) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  if (!configured && !demoMode)
    return (
      <div className="center">
        <div className="setupPanel">
          <div className="brand">
            <span>M</span>
            <b>MindMesh AI Studio Pro</b>
          </div>
          <h1>Connect your workspace</h1>
          <p>
            Copy .env.example to .env and add your Supabase values, or set
            VITE_DEMO_MODE=true to preview the complete interface without API
            keys.
          </p>
        </div>
      </div>
    );
  if (!ready)
    return (
      <div className="center">
        <i className="spinner" />
      </div>
    );
  if (!session && !demoMode) return <Auth />;
  return (
    <Shell email={session?.user.email || "demo@mindmesh.ai"}>
      <Routes>
        <Route path="/" element={<Studio />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}
