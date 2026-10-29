import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Privacy · Verum Society", robots: { index: true, follow: true } };

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), "legal", f), "utf8");

const inline = (t: string): ReactNode[] =>
  t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p));

// Minimale markdown: #, ##, lijsten met "- ", alinea's
function Doc({ md }: { md: string }) {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={out.length} style={{ margin: "8px 0 8px 20px" }}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const line of md.split("\n")) {
    if (line.startsWith("- ")) { list.push(line.slice(2)); continue; }
    flush();
    if (line.startsWith("# ")) out.push(<h1 key={out.length} className="gold-text" style={{ fontSize: "2.4rem", marginBottom: 10 }}>{line.slice(2)}</h1>);
    else if (line.startsWith("## ")) out.push(<h3 key={out.length} style={{ margin: "26px 0 6px" }}>{line.slice(3)}</h3>);
    else if (line.trim()) out.push(<p key={out.length} className="muted" style={{ margin: "6px 0" }}>{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

export default function Privacy() {
  return (
    <div className="wrap" style={{ padding: "48px 0 96px", maxWidth: 760 }}>
      <p className="muted" style={{ marginBottom: 24 }}><a className="link" href="#en">English version ↓</a></p>
      <Doc md={read("privacy.nl.md")} />
      <hr className="rule" />
      <div id="en"><Doc md={read("privacy.en.md")} /></div>
    </div>
  );
}
