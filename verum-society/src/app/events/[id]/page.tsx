"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Attendees, RSVP_OPTIONS } from "@/components/EventCard";
import { useMe } from "@/components/Shell";
import { formatDate, getEvent, listRsvps, setRsvp } from "@/lib/api";
import { KIND_LABEL, type Rsvp, type RsvpStatus, type VEvent } from "@/lib/types";

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useMe();
  const [event, setEvent] = useState<VEvent | null | undefined>(undefined);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);

  const load = useCallback(async () => {
    setEvent(await getEvent(id));
    setRsvps(await listRsvps(id));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (event === undefined) return null;
  if (!event) return <p className="muted">Dit evenement bestaat niet meer. <Link className="link" href="/">Terug</Link></p>;

  const d = formatDate(event.starts_at);
  const mine = rsvps.find((r) => r.user_id === me.id)?.status;
  const answer = async (s: RsvpStatus) => { await setRsvp(id, me.id, s); load(); };
  const group = (s: RsvpStatus) => rsvps.filter((r) => r.status === s);

  return (
    <div className="fade">
      <Link href="/" className="muted" style={{ fontSize: ".8rem", letterSpacing: ".2em", textTransform: "uppercase" }}>← Terug</Link>
      <div className="card gilded" style={{ marginTop: 20, padding: "clamp(24px,5vw,52px)" }}>
        <span className="tag">{KIND_LABEL[event.kind]}</span>
        <h1 className="gold-text" style={{ margin: "6px 0 16px" }}>{event.title}</h1>
        <div className="meta" style={{ fontSize: ".95rem" }}>
          <span style={{ textTransform: "capitalize" }}>{d.full} · {d.time}</span>
          <span>{event.location}</span>
          <span>{event.price_eur ? `€${event.price_eur} p.p.` : "Op uitnodiging"}</span>
        </div>
        <hr className="rule" />
        <p style={{ maxWidth: 640, fontSize: "1.05rem" }}>{event.description}</p>
        <div className="rsvp" style={{ marginTop: 28 }}>
          {RSVP_OPTIONS.map((o) => <button key={o.v} className={`btn ${mine === o.v ? "on" : ""}`} onClick={() => answer(o.v)}>{o.label}</button>)}
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 14 }}>Aanwezig</p>
          <Attendees rsvps={rsvps} capacity={event.capacity} />
          <div style={{ marginTop: 18, display: "grid", gap: 6 }}>
            {group("going").map((r) => <span key={r.user_id}>{r.full_name}</span>)}
            {group("going").length === 0 && <span className="muted">Nog niemand.</span>}
          </div>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 14 }}>Misschien</p>
          <div style={{ display: "grid", gap: 6 }}>
            {group("maybe").map((r) => <span key={r.user_id} className="muted">{r.full_name}</span>)}
            {group("maybe").length === 0 && <span className="muted">Niemand twijfelt nog.</span>}
          </div>
        </div>
      </div>
      <p style={{ marginTop: 24 }}><Link href="/chat" className="link">Bespreek dit in de chat →</Link></p>
    </div>
  );
}
