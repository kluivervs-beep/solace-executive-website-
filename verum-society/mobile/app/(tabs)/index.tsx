import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/auth";
import { EventCard } from "@/EventCard";
import { listEvents, listRsvps, setRsvp } from "@/lib/api";
import { Rsvp, RsvpStatus, VEvent } from "@/lib/types";
import { c } from "@/theme";
import { Backdrop, Body, Card, Eyebrow, H, Rule } from "@/ui";

export default function Home() {
  const me = useMe();
  const inset = useSafeAreaInsets();
  const [events, setEvents] = useState<VEvent[] | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [e, r] = await Promise.all([listEvents(), listRsvps()]);
    const cutoff = Date.now() - 6 * 3600 * 1000;
    setEvents(e.filter((x) => new Date(x.starts_at).getTime() > cutoff));
    setRsvps(r);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const answer = async (id: string, s: RsvpStatus) => { await setRsvp(id, me.id, s); load(); };
  const mine = (id: string) => rsvps.find((r) => r.event_id === id && r.user_id === me.id)?.status;
  const [next, ...rest] = events ?? [];

  return (
    <Backdrop>
      <ScrollView
        contentContainerStyle={{ padding: 22, paddingTop: inset.top + 24, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.gold} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Eyebrow>Welkom terug</Eyebrow>
        <H size={34} style={{ marginTop: 8, marginBottom: 28 }}>{me.full_name.split(" ")[0]}, dit staat er voor je klaar.</H>
        {events === null ? null : !next ? (
          <Card style={{ alignItems: "center", padding: 44 }}>
            <H size={26}>Nog niets gepland</H>
            <Body muted style={{ textAlign: "center", marginTop: 8 }}>Zodra er een nieuw evenement is, zie je het hier als eerste.</Body>
          </Card>
        ) : (
          <>
            <EventCard hero event={next} rsvps={rsvps.filter((r) => r.event_id === next.id)} mine={mine(next.id)} onRsvp={(s) => answer(next.id, s)} />
            {rest.length > 0 && (
              <>
                <Rule />
                <Eyebrow style={{ marginBottom: 16 }}>Daarna</Eyebrow>
                <View style={{ gap: 16 }}>
                  {rest.map((e) => (
                    <EventCard key={e.id} event={e} rsvps={rsvps.filter((r) => r.event_id === e.id)} mine={mine(e.id)} onRsvp={(s) => answer(e.id, s)} />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Backdrop>
  );
}
