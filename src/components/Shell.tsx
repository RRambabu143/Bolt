import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { BookOpen, Brain, History, LogOut, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { demoMode } from "../lib/api";
import UsageMeter from "./UsageMeter";
export default function Shell({
  children,
  email,
}: {
  children: ReactNode;
  email: string;
}) {
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span>M</span>
          <div>
            <b>MindMesh</b>
            <small>AI STUDIO PRO</small>
          </div>
        </div>
        <nav>
          <NavLink to="/">
            <Sparkles />
            Create
          </NavLink>
          <NavLink to="/history">
            <History />
            History
          </NavLink>
          <NavLink to="/mind-chips">
            <Brain />
            Mind Chips
          </NavLink>
          <a href="/setup.html" target="_blank">
            <BookOpen />
            Setup guide
          </a>
        </nav>
        <UsageMeter />
        <div className="profile">
          <i>{email[0].toUpperCase()}</i>
          <span>
            <b>{email.split("@")[0]}</b>
            <small>{demoMode ? "Demo workspace" : "Creator account"}</small>
          </span>
          <button title="Sign out" onClick={() => supabase.auth.signOut()}>
            <LogOut />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <span>Creative command center</span>
          <div>
            <i />
            All systems operational {demoMode && <b>DEMO</b>}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
