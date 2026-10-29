"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { signIn, signUp } from "@/lib/api";
import { isDemo } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "up") await signUp(email, pw, name); else await signIn(email, pw);
      window.location.href = "/"; // forceert verse sessie in de Shell
    } catch (x) {
      setErr((x as Error).message); setBusy(false);
    }
  };

  return (
    <div className="center">
      <div className="auth fade">
        <div className="logo"><Logo /></div>
        <p className="eyebrow">Private members club</p>
        <h1 className="gold-text" style={{ fontSize: "2.4rem", marginTop: 10 }}>
          {mode === "in" ? "Welkom terug" : "Vraag toegang aan"}
        </h1>
        <p className="muted" style={{ marginTop: 10 }}>
          {mode === "in" ? "Alleen voor leden." : "Maak een account. Na een korte vragenlijst beoordelen we je aanvraag persoonlijk."}
        </p>
        <form onSubmit={submit}>
          {mode === "up" && (
            <div className="field"><label>Volledige naam</label><input type="text" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          <div className="field"><label>E-mail</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <div className="field"><label>Wachtwoord</label><input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>
          {err && <p className="error">{err}</p>}
          <button className="btn solid" style={{ width: "100%" }} disabled={busy}>{mode === "in" ? "Binnenkomen" : "Aanvraag starten"}</button>
        </form>
        <p className="muted" style={{ marginTop: 22 }}>
          {mode === "in" ? "Nog geen lid? " : "Al lid? "}
          <button className="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}>
            {mode === "in" ? "Vraag toegang aan" : "Log in"}
          </button>
        </p>
        {isDemo && (
          <p className="muted" style={{ marginTop: 28, fontSize: ".78rem" }}>
            Demo-modus: elk e-mailadres werkt. Gebruik een adres met “admin” (bv. admin@verum.nl) om het beheerpaneel te zien. Bij “Vraag toegang aan” kun je zelf het aanmeldproces doorlopen.
          </p>
        )}
      </div>
    </div>
  );
}
