"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getProfile, signOut } from "@/lib/api";
import { isDemo, supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { Logo, Mark } from "./Logo";

interface Ctx { me: Profile; refresh: () => Promise<void>; }
const AuthCtx = createContext<Ctx | null>(null);
export const useMe = () => useContext(AuthCtx)!;

const icons = {
  home: <path d="M3 11l9-8 9 8v10H3z" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  me: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  admin: <path d="M12 3l8 4v6c0 4-3 7-8 8-5-1-8-4-8-8V7z" />,
};

const PUBLIC = ["/login", "/privacy"];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try { setMe(await getProfile()); } catch { setMe(null); }
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    if (isDemo) return;
    const { data } = supabase!.auth.onAuthStateChange(() => { refresh(); });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;
    if (!me && !PUBLIC.includes(path)) router.replace("/login");
    if (me && path === "/login") router.replace("/");
    if (me?.status === "onboarding" && path !== "/onboarding") router.replace("/onboarding");
  }, [ready, me, path, router]);

  if (!ready) return <div className="center"><Mark size={56} /></div>;
  if (!me) return PUBLIC.includes(path) ? <>{children}</> : null;

  const out = async () => { await signOut(); await refresh(); router.replace("/login"); };

  if (me.status === "onboarding") return <AuthCtx.Provider value={{ me, refresh }}>{children}</AuthCtx.Provider>;

  if (me.status !== "active") {
    return (
      <div className="center">
        <div className="auth fade">
          <div className="logo"><Mark size={56} /><span><b>VERUM</b></span></div>
          <p className="eyebrow">{me.status === "pending" ? "Aanvraag in behandeling" : "Toegang geblokkeerd"}</p>
          <h2 style={{ margin: "14px 0" }}>
            {me.status === "pending" ? <>Dank je, {me.full_name.split(" ")[0]}.</> : "Je lidmaatschap is gepauzeerd."}
          </h2>
          <p className="muted">
            {me.status === "pending"
              ? "We lezen je antwoorden en activeren je account persoonlijk. Je hoort van ons zodra je binnen bent."
              : "Neem contact op met het Verum-team."}
          </p>
          <hr className="rule" />
          <button className="link" onClick={out}>Uitloggen</button>
        </div>
      </div>
    );
  }

  const links = [
    { href: "/", label: "Home", icon: icons.home },
    { href: "/chat", label: "Chat", icon: icons.chat },
    { href: "/profile", label: "Profiel", icon: icons.me },
    ...(me.role === "admin" ? [{ href: "/admin", label: "Beheer", icon: icons.admin }] : []),
  ];
  const on = (h: string) => (h === "/" ? path === "/" || path.startsWith("/events") : path.startsWith(h));

  return (
    <AuthCtx.Provider value={{ me, refresh }}>
      <header className="topbar">
        <div className="wrap">
          <Link href="/"><Logo /></Link>
          <nav className="nav-links">
            {links.map((l) => <Link key={l.href} href={l.href} className={on(l.href) ? "on" : ""}>{l.label}</Link>)}
            <button className="link" onClick={out} style={{ fontSize: ".75rem", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--muted)", borderColor: "transparent" }}>Uit</button>
          </nav>
        </div>
      </header>
      {isDemo && (
        <div style={{ textAlign: "center", padding: "6px 12px", fontSize: ".68rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--warn)", borderBottom: "1px solid var(--line-soft)" }}>
          Demo-modus · data blijft alleen in deze browser
        </div>
      )}
      <main className="page"><div className="wrap">{children}</div></main>
      <nav className="tabbar">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={on(l.href) ? "on" : ""}>
            <svg viewBox="0 0 24 24">{l.icon}</svg>{l.label}
          </Link>
        ))}
      </nav>
    </AuthCtx.Provider>
  );
}
