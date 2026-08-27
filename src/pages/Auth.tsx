import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
export default function Auth() {
  const [e, setE] = useState(""),
    [p, setP] = useState(""),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false);
  async function go(x: FormEvent) {
    x.preventDefault();
    setBusy(true);
    const r = signup
      ? await supabase.auth.signUp({ email: e, password: p })
      : await supabase.auth.signInWithPassword({ email: e, password: p });
    setBusy(false);
    r.error
      ? toast.error(r.error.message)
      : toast.success(signup ? "Check your email" : "Welcome back");
  }
  return (
    <div className="auth">
      <section className="authHero">
        <div>
          <span className="eyebrow">
            <Sparkles /> MULTIMODAL CREATIVE AI
          </span>
          <h1>
            One studio.
            <br />
            <em>Infinite realities.</em>
          </h1>
          <p>
            Write with GPT. Create extraordinary images. Direct cinematic worlds
            with Veo.
          </p>
        </div>
      </section>
      <section className="authBox">
        <form onSubmit={go}>
          <div className="brand">
            <span>M</span>
            <b>MindMesh AI</b>
          </div>
          <h2>{signup ? "Create account" : "Welcome back"}</h2>
          <p>Continue to your creative command center.</p>
          <label>
            Email
            <input
              type="email"
              required
              value={e}
              onChange={(x) => setE(x.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              required
              value={p}
              onChange={(x) => setP(x.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => setSignup(!signup)}
          >
            {signup
              ? "Already registered? Sign in"
              : "New here? Create an account"}
          </button>
        </form>
      </section>
    </div>
  );
}
