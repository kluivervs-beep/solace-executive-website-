import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useMe } from "@/auth";
import { Attendees, RsvpButtons } from "@/EventCard";
import { formatDate, getEvent, listRsvps, setRsvp } from "@/lib/api";
import { KIND_LABEL, Rsvp, RsvpStatus, VEvent } from "@/lib/types";
import { c, f } from "@/theme";
import { Backdrop, Body, Card, Eyebrow, H, Rule } from "@/ui";

export default function EventScreen() {
  const { me } = useAuth();
  return me ? <EventPage /> : null;
}

function EventPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const [event, setEvent] = useState<VEvent | null | undefined>(undefined);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);

  const load = useCallback(async () => { setEvent(await getEvent(id)); setRsvps(await listRsvps(id)); }, [id]);
  useEffect(() => { load(); }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const names = (s: RsvpStatus) => rsvps.filter((r) => r.status === s).map((r) => r.full_name).filter(Boolean).join(", ");

  return (
    <Backdrop>
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: inset.top + 14, paddingBottom: 48 }}>
        <Text onPress={back} style={{ color: c.muted, fontFamily: f.sansMed, fontSize: 12, letterSpacing: 2.4, marginBottom: 22 }}>
          <Ionicons name="chevron-back" size={12} /> TERUG
        </Text>
        {event === undefined ? null : event === null ? <Body muted>Dit evenement bestaat niet meer.</Body> : (() => {
          const d = formatDate(event.starts_at);
          return (
            <>
              <Eyebrow>{KIND_LABEL[event.kind]}</Eyebrow>
              <H size={42} gold style={{ marginVertical: 12 }}>{event.title}</H>
              <Body muted style={{ textTransform: "capitalize" }}>{d.full} · {d.time}</Body>
              <Body muted>{event.location} · {event.price_eur ? `€${event.price_eur} p.p.` : "Op uitnodiging"}</Body>
              <Rule />
              <Body style={{ fontSize: 16, lineHeight: 25 }}>{event.description}</Body>
              <RsvpButtons mine={rsvps.find((r) => r.user_id === me.id)?.status} onRsvp={async (s) => { await setRsvp(id, me.id, s); load(); }} />
              <Card style={{ marginTop: 28 }}>
                <Eyebrow style={{ marginBottom: 14 }}>Aanwezig</Eyebrow>
                <Attendees rsvps={rsvps} capacity={event.capacity} />
                <Body style={{ marginTop: 14 }}>{names("going") || "Nog niemand."}</Body>
              </Card>
              <Card style={{ marginTop: 14 }}>
                <Eyebrow style={{ marginBottom: 10 }}>Misschien</Eyebrow>
                <Body muted>{names("maybe") || "Niemand twijfelt nog."}</Body>
              </Card>
            </>
          );
        })()}
      </ScrollView>
    </Backdrop>
  );
}
