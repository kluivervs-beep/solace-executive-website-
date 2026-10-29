"use client";
import Link from "next/link";
import { formatDate } from "@/lib/api";
import { KIND_LABEL, type Rsvp, type RsvpStatus, type VEvent } from "@/lib/types";

export const RSVP_OPTIONS: { v: RsvpStatus; label: string }[] = [
  { v: "going", label: "Ik ben erbij" },
  { v: "maybe", label: "Misschien" },
  { v: "declined", label: "Kan niet" },
];

export function Attendees({ rsvps, capacity }: { rsvps: Rsvp[]; capacity: number | null }) {
  const going = rsvps.filter((r) => r.status === "going");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="faces">
          {going.slice(0, 5).map((r) => (
            <span className="face" key={r.user_id}>{(r.full_name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
          ))}
        </div>
        <span className="count">
          {going.length === 0 ? "Nog niemand, wees de eerste" : `${going.length}${capacity ? ` / ${capacity}` : ""} komen`}
        </span>
      </div>
      {capacity ? <div className="bar"><i style={{ width: `${Math.min(100, (going.length / capacity) * 100)}%` }} /></div> : null}
    </div>
  );
}

export function EventCard({
  event, rsvps, mine, onRsvp, hero,
}: {
  event: VEvent; rsvps: Rsvp[]; mine?: RsvpStatus; onRsvp: (s: RsvpStatus) => void; hero?: boolean;
}) {
  const d = formatDate(event.starts_at);
  return (
    <article className={`event ${hero ? "hero" : ""}`}>
      {!hero && <div className="datebox"><b>{d.day}</b><span>{d.month}</span></div>}
      <div>
        <span className="tag">{hero ? "Eerstvolgende · " : ""}{KIND_LABEL[event.kind]}</span>
        <Link href={`/events/${event.id}`}>
          {hero ? <h1 className="gold-text" style={{ fontSize: "clamp(2rem,5vw,3.2rem)" }}>{event.title}</h1> : <h3>{event.title}</h3>}
        </Link>
        <div className="meta" style={{ marginTop: 8 }}>
          <span>{d.weekday} {hero ? `${d.day} ${d.month} · ` : "· "}{d.time}</span>
          <span>{event.location}</span>
          {event.price_eur ? <span>€{event.price_eur} p.p.</span> : <span>Op uitnodiging</span>}
        </div>
        {hero && <p className="muted" style={{ margin: "16px 0 0", maxWidth: 560 }}>{event.description}</p>}
        <div style={{ marginTop: 18 }}><Attendees rsvps={rsvps} capacity={event.capacity} /></div>
        <div className="rsvp">
          {RSVP_OPTIONS.map((o) => (
            <button key={o.v} className={`btn sm ${mine === o.v ? "on" : ""}`} onClick={() => onRsvp(o.v)}>{o.label}</button>
          ))}
        </div>
      </div>
    </article>
  );
}
