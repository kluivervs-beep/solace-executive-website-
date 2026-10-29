"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { createEvent, deleteEvent, formatDate, listEvents, listMembers, listRsvps, setMemberStatus } from "@/lib/api";
import { KIND_LABEL, type EventKind, type MemberStatus, type Profile, type Rsvp, type VEvent } from "@/lib/types";

export default function Admin() {
  const { me } = useMe();
  const router = useRouter();
  const [tab, setTab] = useState<"members" | "events">("members");
  const [members, setMembers] = useState<Profile[]>([]);
  const [events, setEvents] = useState<VEvent[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, e, r] = await Promise.all([listMembers(), listEvents(), listRsvps()]);
    setMembers(m); setEvents(e); setRsvps(r);
  }, []);
  useEffect(() => { if (me.role !== "admin") router.replace("/"); else load(); }, [me, router, load]);
  if (me.role !== "admin") return null;

  const set = async (id: string, s: MemberStatus) => { await setMemberStatus(id, s); load(); };
  const pending = members.filter((m) => m.status === "pending");
  const rest = members.filter((m) => m.status !== "pending" && m.status !== "onboarding");
  const onboarding = members.filter((m) => m.status === "onboarding");

  return (
    <div className="fade">
      <p className="eyebrow">Beheer</p>
      <h2 style={{ margin: "8px 0 24px" }}>Verum Society</h2>
      <div className="tabs">
        <button className={tab === "members" ? "on" : ""} onClick={() => setTab("members")}>Leden {pending.length > 0 && `(${pending.length} nieuw)`}</button>
        <button className={tab === "events" ? "on" : ""} onClick={() => setTab("events")}>Evenementen</button>
      </div>

      {tab === "members" && (
        <>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Wachten op activatie</p>
          {pending.length === 0 && <p className="muted" style={{ padding: "14px 0" }}>Geen openstaande aanvragen.</p>}
          {pending.map((m) => (
            <div key={m.id}>
              <div className="row">
                <div>
                  <b>{m.full_name}</b> <span className="muted">· {m.email}</span>
                  <div><button className="link" onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? "Verberg antwoorden" : "Bekijk vragenlijst"}</button></div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn sm solid" onClick={() => set(m.id, "active")}>Activeer</button>
                  <button className="btn sm danger" onClick={() => set(m.id, "suspended")}>Weiger</button>
                </div>
              </div>
              {open === m.id && m.questionnaire && (
                <dl className="qa card" style={{ margin: "14px 0" }}>
                  <dt>Wat ze brengen</dt><dd>{m.questionnaire.brings}</dd>
                  <dt>Expertise</dt><dd>{m.questionnaire.expertise || "-"}</dd>
                  <dt>Interesses</dt><dd>{m.questionnaire.interests.join(" · ")}</dd>
                  <dt>Waarom Verum</dt><dd>{m.questionnaire.why}</dd>
                  <dt>Dieet</dt><dd>{m.questionnaire.dietary || "-"}</dd>
                  <dt>Instagram</dt><dd>{m.questionnaire.instagram || "-"}</dd>
                </dl>
              )}
            </div>
          ))}

          <p className="eyebrow" style={{ margin: "34px 0 6px" }}>Alle leden</p>
          {rest.map((m) => (
            <div className="row" key={m.id}>
              <div><b>{m.full_name}</b> <span className="muted">· {m.email}</span> {m.role === "admin" && <span className="tag" style={{ marginLeft: 8, marginBottom: 0 }}>Admin</span>}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className={`pill ${m.status}`}>{m.status === "active" ? "Actief" : "Geblokkeerd"}</span>
                {m.id !== me.id && (m.status === "active"
                  ? <button className="btn sm danger" onClick={() => set(m.id, "suspended")}>Pauzeer</button>
                  : <button className="btn sm" onClick={() => set(m.id, "active")}>Heractiveer</button>)}
              </div>
            </div>
          ))}
          {onboarding.length > 0 && <p className="muted" style={{ marginTop: 20, fontSize: ".85rem" }}>{onboarding.length} aanmelding(en) hebben de vragenlijst nog niet afgerond.</p>}
        </>
      )}

      {tab === "events" && (
        <>
          <NewEvent onDone={load} />
          <p className="eyebrow" style={{ margin: "34px 0 6px" }}>Alle evenementen</p>
          {events.map((e) => {
            const going = rsvps.filter((r) => r.event_id === e.id && r.status === "going");
            return (
              <div className="row" key={e.id}>
                <div>
                  <b>{e.title}</b>
                  <div className="muted" style={{ fontSize: ".82rem" }}>{KIND_LABEL[e.kind]} · {formatDate(e.starts_at).full} · {going.length}{e.capacity ? `/${e.capacity}` : ""} komen</div>
                  {going.length > 0 && <div className="muted" style={{ fontSize: ".78rem" }}>{going.map((g) => g.full_name).join(", ")}</div>}
                </div>
                <button className="btn sm danger" onClick={async () => { if (confirm(`"${e.title}" verwijderen?`)) { await deleteEvent(e.id); load(); } }}>Verwijder</button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function NewEvent({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ title: "", description: "", kind: "diner" as EventKind, starts_at: "", location: "", capacity: "", price: "" });
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    await createEvent({
      title: f.title, description: f.description, kind: f.kind, location: f.location,
      starts_at: new Date(f.starts_at).toISOString(),
      capacity: f.capacity ? Number(f.capacity) : null,
      price_eur: f.price ? Number(f.price) : null,
    });
    setF({ title: "", description: "", kind: "diner", starts_at: "", location: "", capacity: "", price: "" });
    setBusy(false); onDone();
  };
  return (
    <form className="card gilded" onSubmit={submit}>
      <p className="eyebrow" style={{ marginBottom: 18 }}>Nieuw evenement</p>
      <div className="field"><label>Titel</label><input type="text" required value={f.title} onChange={(e) => up("title", e.target.value)} /></div>
      <div className="grid two">
        <div className="field"><label>Soort</label>
          <select value={f.kind} onChange={(e) => up("kind", e.target.value)}>
            {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <div className="field"><label>Datum & tijd</label><input type="datetime-local" required value={f.starts_at} onChange={(e) => up("starts_at", e.target.value)} /></div>
      </div>
      <div className="field"><label>Locatie</label><input type="text" required value={f.location} onChange={(e) => up("location", e.target.value)} /></div>
      <div className="grid two">
        <div className="field"><label>Capaciteit (optioneel)</label><input type="number" min={1} value={f.capacity} onChange={(e) => up("capacity", e.target.value)} /></div>
        <div className="field"><label>Prijs p.p. in € (optioneel)</label><input type="number" min={0} value={f.price} onChange={(e) => up("price", e.target.value)} /></div>
      </div>
      <div className="field"><label>Beschrijving</label><textarea value={f.description} onChange={(e) => up("description", e.target.value)} /></div>
      <button className="btn solid" disabled={busy}>Publiceer</button>
    </form>
  );
}
