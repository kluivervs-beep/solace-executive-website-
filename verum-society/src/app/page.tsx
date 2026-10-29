"use client";
import { useCallback, useEffect, useState } from "react";
import { EventCard } from "@/components/EventCard";
import { useMe } from "@/components/Shell";
import { listEvents, listRsvps, setRsvp } from "@/lib/api";
import type { Rsvp, RsvpStatus, VEvent } from "@/lib/types";

export default function Home() {
  const { me } = useMe();
  const [events, setEvents] = useState<VEvent[] | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);

  const load = useCallback(async () => {
    const [e, r] = await Promise.all([listEvents(), listRsvps()]);
    const now = Date.now() - 6 * 3600 * 1000;
    setEvents(e.filter((x) => new Date(x.starts_at).getTime() > now));
    setRsvps(r);
  }, []);
  useEffect(() => { load(); }, [load]);

  const answer = async (id: string, s: RsvpStatus) => { await setRsvp(id, me.id, s); load(); };
  const mine = (id: string) => rsvps.find((r) => r.event_id === id && r.user_id === me.id)?.status;
  const [next, ...rest] = events ?? [];

  return (
    <div className="stagger">
      <div style={{ marginBottom: 36 }}>
        <p className="eyebrow">Welkom terug</p>
        <h2 style={{ marginTop: 8 }}>{me.full_name.split(" ")[0]}, dit staat er voor je klaar.</h2>
      </div>

      {events === null ? null : !next ? (
        <div className="card gilded" style={{ textAlign: "center", padding: 60 }}>
          <h3>Nog niets gepland</h3>
          <p className="muted">Zodra er een nieuw evenement is, zie je het hier als eerste.</p>
        </div>
      ) : (
        <>
          <EventCard hero event={next} rsvps={rsvps.filter((r) => r.event_id === next.id)} mine={mine(next.id)} onRsvp={(s) => answer(next.id, s)} />
          {rest.length > 0 && (
            <>
              <hr className="rule" />
              <p className="eyebrow" style={{ marginBottom: 18 }}>Daarna</p>
              <div className="grid">
                {rest.map((e) => (
                  <EventCard key={e.id} event={e} rsvps={rsvps.filter((r) => r.event_id === e.id)} mine={mine(e.id)} onRsvp={(s) => answer(e.id, s)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
