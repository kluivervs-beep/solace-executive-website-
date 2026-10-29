import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/auth";
import { createEvent, deleteEvent, formatDate, listEvents, listMembers, listRsvps, setMemberStatus } from "@/lib/api";
import { EventKind, KIND_LABEL, MemberStatus, Profile, Rsvp, VEvent } from "@/lib/types";
import { c, f } from "@/theme";
import { Backdrop, Body, Btn, Card, Chip, Eyebrow, Field, H } from "@/ui";

const confirm = (msg: string, ok: () => void) => {
  if (Platform.OS === "web") { if (window.confirm(msg)) ok(); return; }
  Alert.alert(msg, undefined, [{ text: "Annuleer", style: "cancel" }, { text: "Ja", style: "destructive", onPress: ok }]);
};

export default function Admin() {
  const me = useMe();
  const inset = useSafeAreaInsets();
  const [tab, setTab] = useState<"members" | "events">("members");
  const [members, setMembers] = useState<Profile[]>([]);
  const [events, setEvents] = useState<VEvent[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, e, r] = await Promise.all([listMembers(), listEvents(), listRsvps()]);
    setMembers(m); setEvents(e); setRsvps(r);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = async (id: string, s: MemberStatus) => { await setMemberStatus(id, s); load(); };
  const pending = members.filter((m) => m.status === "pending");
  const rest = members.filter((m) => m.status === "active" || m.status === "suspended");

  return (
    <Backdrop>
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: inset.top + 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Eyebrow>Beheer</Eyebrow>
        <H size={32} style={{ marginTop: 6, marginBottom: 18 }}>Verum Society</H>
        <View style={{ flexDirection: "row", marginBottom: 22 }}>
          <Chip label={`Leden${pending.length ? ` (${pending.length} nieuw)` : ""}`} on={tab === "members"} onPress={() => setTab("members")} />
          <Chip label="Evenementen" on={tab === "events"} onPress={() => setTab("events")} />
        </View>

        {tab === "members" ? (
          <>
            <Eyebrow style={{ marginBottom: 10 }}>Wachten op activatie</Eyebrow>
            {pending.length === 0 && <Body muted>Geen openstaande aanvragen.</Body>}
            {pending.map((m) => (
              <Card key={m.id} style={{ marginBottom: 12 }}>
                <Text style={{ color: c.cream, fontFamily: f.sansMed, fontSize: 16 }}>{m.full_name}</Text>
                <Body muted>{m.email}</Body>
                <Text onPress={() => setOpen(open === m.id ? null : m.id)} style={{ color: c.gold, fontFamily: f.sans, marginTop: 8 }}>
                  {open === m.id ? "Verberg antwoorden" : "Bekijk vragenlijst"}
                </Text>
                {open === m.id && m.questionnaire && (
                  <View style={{ marginTop: 6 }}>
                    {([["Wat ze brengen", m.questionnaire.brings], ["Expertise", m.questionnaire.expertise], ["Interesses", m.questionnaire.interests.join(" · ")], ["Waarom Verum", m.questionnaire.why], ["Dieet", m.questionnaire.dietary], ["Instagram", m.questionnaire.instagram]] as const).map(([k, v]) => (
                      <View key={k} style={{ marginTop: 10 }}>
                        <Text style={{ color: c.gold, fontFamily: f.sansMed, fontSize: 10, letterSpacing: 2.2 }}>{k.toUpperCase()}</Text>
                        <Body>{v || "-"}</Body>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Btn small solid label="Activeer" onPress={() => set(m.id, "active")} />
                  <Btn small danger label="Weiger" onPress={() => set(m.id, "suspended")} />
                </View>
              </Card>
            ))}
            <Eyebrow style={{ marginTop: 28, marginBottom: 10 }}>Alle leden</Eyebrow>
            {rest.map((m) => (
              <View key={m.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.lineSoft }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.cream, fontFamily: f.sansMed }}>{m.full_name}{m.role === "admin" ? "  · ADMIN" : ""}</Text>
                  <Text style={{ color: m.status === "active" ? c.ok : c.muted, fontFamily: f.sans, fontSize: 12 }}>{m.status === "active" ? "Actief" : "Geblokkeerd"}</Text>
                </View>
                {m.id !== me.id && (m.status === "active"
                  ? <Btn small danger label="Pauzeer" onPress={() => set(m.id, "suspended")} />
                  : <Btn small label="Heractiveer" onPress={() => set(m.id, "active")} />)}
              </View>
            ))}
          </>
        ) : (
          <>
            <NewEvent onDone={load} />
            <Eyebrow style={{ marginTop: 28, marginBottom: 10 }}>Alle evenementen</Eyebrow>
            {events.map((e) => {
              const going = rsvps.filter((r) => r.event_id === e.id && r.status === "going");
              return (
                <View key={e.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.lineSoft }}>
                  <Text style={{ color: c.cream, fontFamily: f.sansMed, fontSize: 15 }}>{e.title}</Text>
                  <Body muted style={{ fontSize: 12.5 }}>{KIND_LABEL[e.kind]} · {formatDate(e.starts_at).full} · {going.length}{e.capacity ? `/${e.capacity}` : ""} komen</Body>
                  {going.length > 0 && <Body muted style={{ fontSize: 12 }}>{going.map((g) => g.full_name).join(", ")}</Body>}
                  <View style={{ alignSelf: "flex-start", marginTop: 10 }}>
                    <Btn small danger label="Verwijder" onPress={() => confirm(`"${e.title}" verwijderen?`, async () => { await deleteEvent(e.id); load(); })} />
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </Backdrop>
  );
}

function NewEvent({ onDone }: { onDone: () => void }) {
  const empty = { title: "", description: "", kind: "diner" as EventKind, when: "", location: "", capacity: "", price: "" };
  const [f_, setF] = useState(empty);
  const [err, setErr] = useState("");
  const up = (k: keyof typeof empty, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    // Verwacht "2026-12-05 20:00"
    const d = new Date(f_.when.trim().replace(" ", "T"));
    if (isNaN(d.getTime())) { setErr("Datum en tijd als 2026-12-05 20:00"); return; }
    setErr("");
    await createEvent({
      title: f_.title.trim(), description: f_.description.trim(), kind: f_.kind, location: f_.location.trim(),
      starts_at: d.toISOString(), capacity: f_.capacity ? Number(f_.capacity) : null, price_eur: f_.price ? Number(f_.price) : null,
    });
    setF(empty); onDone();
  };
  return (
    <Card>
      <Eyebrow style={{ marginBottom: 16 }}>Nieuw evenement</Eyebrow>
      <Field label="Titel" value={f_.title} onChangeText={(t) => up("title", t)} />
      <Text style={{ color: c.gold, fontFamily: f.sansMed, fontSize: 11, letterSpacing: 2.6, marginBottom: 8 }}>SOORT</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
        {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <Chip key={k} label={KIND_LABEL[k]} on={f_.kind === k} onPress={() => setF((p) => ({ ...p, kind: k }))} />)}
      </View>
      <Field label="Datum & tijd" hint="Bijvoorbeeld 2026-12-05 20:00" value={f_.when} onChangeText={(t) => up("when", t)} autoCapitalize="none" />
      <Field label="Locatie" value={f_.location} onChangeText={(t) => up("location", t)} />
      <Field label="Capaciteit (optioneel)" value={f_.capacity} onChangeText={(t) => up("capacity", t)} keyboardType="number-pad" />
      <Field label="Prijs p.p. in € (optioneel)" value={f_.price} onChangeText={(t) => up("price", t)} keyboardType="number-pad" />
      <Field label="Beschrijving" multiline value={f_.description} onChangeText={(t) => up("description", t)} />
      {err ? <Text style={{ color: c.bad, fontFamily: f.sans, marginBottom: 12 }}>{err}</Text> : null}
      <Btn solid label="Publiceer" onPress={submit} disabled={!f_.title.trim() || !f_.when.trim() || !f_.location.trim()} />
    </Card>
  );
}
