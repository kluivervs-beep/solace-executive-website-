import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth";
import { saveQuestionnaire } from "@/lib/api";
import { INTEREST_OPTIONS, Questionnaire } from "@/lib/types";
import { c } from "@/theme";
import { Backdrop, Body, Btn, Chip, Eyebrow, Field, H } from "@/ui";

export default function Onboarding() {
  const { me, refresh } = useAuth();
  const inset = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState<Questionnaire>({ brings: "", interests: [], expertise: "", why: "", dietary: "", instagram: "" });
  const set = <K extends keyof Questionnaire>(k: K, v: Questionnaire[K]) => setQ((p) => ({ ...p, [k]: v }));
  const toggle = (i: string) => set("interests", q.interests.includes(i) ? q.interests.filter((x) => x !== i) : [...q.interests, i]);

  const steps = [
    {
      title: "Wat breng jij naar Verum?", ok: q.brings.trim().length > 3,
      body: (<>
        <Body muted style={{ marginBottom: 22 }}>Verum is wat leden er samen van maken. Vertel ons wat jij toevoegt aan de tafel.</Body>
        <Field label="Jouw bijdrage" multiline value={q.brings} onChangeText={(t) => set("brings", t)} placeholder="Bijvoorbeeld: ik kook, ik ken de beste tafels in de stad, ik draai muziek…" />
        <Field label="Jouw vak of expertise" value={q.expertise} onChangeText={(t) => set("expertise", t)} placeholder="Wat doe je, en waar ben je goed in?" />
      </>),
    },
    {
      title: "Waar word je blij van?", ok: q.interests.length > 0,
      body: (<>
        <Body muted style={{ marginBottom: 22 }}>Kies wat bij je past. Zo plannen we avonden waar je graag bij bent.</Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 26 }}>
          {INTEREST_OPTIONS.map((i) => <Chip key={i} label={i} on={q.interests.includes(i)} onPress={() => toggle(i)} />)}
        </View>
        <Field label="Dieetwensen of allergieën" value={q.dietary} onChangeText={(t) => set("dietary", t)} placeholder="Geen, vegetarisch, notenallergie…" />
      </>),
    },
    {
      title: "Waarom Verum?", ok: q.why.trim().length > 3,
      body: (<>
        <Field label="Waarom wil je lid worden?" multiline value={q.why} onChangeText={(t) => set("why", t)} placeholder="Wat zoek je in een besloten club?" />
        <Field label="Instagram (optioneel)" value={q.instagram} onChangeText={(t) => set("instagram", t)} autoCapitalize="none" placeholder="@jouwnaam" />
      </>),
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  const finish = async () => { setBusy(true); await saveQuestionnaire(q); await refresh(); };

  return (
    <Backdrop>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 28, paddingTop: inset.top + 32, paddingBottom: inset.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 26 }}>
            {steps.map((_, i) => <View key={i} style={{ flex: 1, height: 2, backgroundColor: i <= step ? c.gold : c.lineSoft }} />)}
          </View>
          <Eyebrow>{`Welkom, ${me?.full_name.split(" ")[0]} · Stap ${step + 1} van ${steps.length}`}</Eyebrow>
          <H size={36} gold style={{ marginVertical: 14 }}>{s.title}</H>
          {s.body}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            {step > 0 && <Btn label="Terug" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
            <Btn solid style={{ flex: 2 }} label={last ? "Aanvraag versturen" : "Verder"} disabled={!s.ok} loading={busy} onPress={last ? finish : () => setStep(step + 1)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Backdrop>
  );
}
