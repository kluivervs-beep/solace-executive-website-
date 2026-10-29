import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDate } from "./lib/api";
import { KIND_LABEL, Rsvp, RsvpStatus, VEvent } from "./lib/types";
import { c, f } from "./theme";
import { Btn, H } from "./ui";

export const RSVP_OPTIONS: { v: RsvpStatus; label: string }[] = [
  { v: "going", label: "Ik ben erbij" },
  { v: "maybe", label: "Misschien" },
  { v: "declined", label: "Kan niet" },
];

export function Attendees({ rsvps, capacity }: { rsvps: Rsvp[]; capacity: number | null }) {
  const going = rsvps.filter((r) => r.status === "going");
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {going.slice(0, 5).map((r, i) => (
          <View key={r.user_id} style={[s.face, i > 0 && { marginLeft: -8 }]}>
            <Text style={{ color: c.goldHi, fontSize: 10, fontFamily: f.sansMed }}>
              {(r.full_name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </Text>
          </View>
        ))}
        <Text style={{ color: c.muted, fontFamily: f.sans, fontSize: 13, marginLeft: going.length ? 10 : 0 }}>
          {going.length === 0 ? "Nog niemand, wees de eerste" : `${going.length}${capacity ? ` / ${capacity}` : ""} komen`}
        </Text>
      </View>
      {capacity ? (
        <View style={{ height: 2, backgroundColor: c.lineSoft, marginTop: 12 }}>
          <LinearGradient colors={[c.wine, c.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 2, width: `${Math.min(100, (going.length / capacity) * 100)}%` }} />
        </View>
      ) : null}
    </View>
  );
}

export function RsvpButtons({ mine, onRsvp }: { mine?: RsvpStatus; onRsvp: (s: RsvpStatus) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
      {RSVP_OPTIONS.map((o) => <Btn key={o.v} small label={o.label} on={mine === o.v} onPress={() => onRsvp(o.v)} />)}
    </View>
  );
}

export function EventCard({ event, rsvps, mine, onRsvp, hero }: {
  event: VEvent; rsvps: Rsvp[]; mine?: RsvpStatus; onRsvp: (s: RsvpStatus) => void; hero?: boolean;
}) {
  const router = useRouter();
  const d = formatDate(event.starts_at);
  const body = (
    <View style={{ padding: hero ? 26 : 20 }}>
      <View style={s.tag}><Text style={s.tagTxt}>{((hero ? "Eerstvolgende · " : "") + KIND_LABEL[event.kind]).toUpperCase()}</Text></View>
      <Pressable onPress={() => router.push(`/event/${event.id}`)}>
        <H size={hero ? 38 : 26} gold={hero}>{event.title}</H>
      </Pressable>
      <Text style={s.meta}>
        {`${d.weekday} ${d.day} ${d.month} · ${d.time}`}{"\n"}{event.location} · {event.price_eur ? `€${event.price_eur} p.p.` : "Op uitnodiging"}
      </Text>
      {hero && <Text style={[s.meta, { marginTop: 14 }]} numberOfLines={4}>{event.description}</Text>}
      <View style={{ marginTop: 18 }}><Attendees rsvps={rsvps} capacity={event.capacity} /></View>
      <RsvpButtons mine={mine} onRsvp={onRsvp} />
    </View>
  );
  return hero ? (
    <LinearGradient colors={["rgba(122,28,51,0.6)", "rgba(19,14,17,0.95)"]} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 0.8 }} style={[s.card, { borderColor: c.line }]}>{body}</LinearGradient>
  ) : (
    <View style={[s.card, { backgroundColor: "rgba(27,19,23,0.8)" }]}>{body}</View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: c.lineSoft, borderRadius: 6, overflow: "hidden" },
  tag: { alignSelf: "flex-start", borderWidth: 1, borderColor: c.line, borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10, marginBottom: 10 },
  tagTxt: { color: c.gold, fontFamily: f.sansMed, fontSize: 10, letterSpacing: 2.4 },
  meta: { color: c.muted, fontFamily: f.sans, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  face: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.wine, borderWidth: 2, borderColor: c.ink, alignItems: "center", justifyContent: "center" },
});
