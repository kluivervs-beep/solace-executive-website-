import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth";
import { Mark } from "@/Mark";
import { signIn, signUp } from "@/lib/api";
import { isDemo } from "@/lib/supabase";
import { c, f } from "@/theme";
import { Backdrop, Body, Btn, Eyebrow, Field, H } from "@/ui";

export default function Login() {
  const { refresh } = useAuth();
  const inset = useSafeAreaInsets();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "up") await signUp(email.trim(), pw, name.trim()); else await signIn(email.trim(), pw);
      await refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const ok = email.includes("@") && pw.length >= 6 && (mode === "in" || name.trim().length > 1);

  return (
    <Backdrop>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 28, paddingTop: inset.top + 48, paddingBottom: inset.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Mark size={64} />
            <Text style={{ fontFamily: f.serif, color: c.cream, fontSize: 26, letterSpacing: 10, marginTop: 18 }}>VERUM</Text>
            <Text style={{ fontFamily: f.sansMed, color: c.gold, fontSize: 10, letterSpacing: 7, marginTop: 4 }}>SOCIETY</Text>
          </View>
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <Eyebrow>Private members club</Eyebrow>
            <H size={36} gold style={{ marginTop: 10, textAlign: "center" }}>{mode === "in" ? "Welkom terug" : "Vraag toegang aan"}</H>
            <Body muted style={{ textAlign: "center", marginTop: 10 }}>
              {mode === "in" ? "Alleen voor leden." : "Maak een account. Na een korte vragenlijst beoordelen we je aanvraag persoonlijk."}
            </Body>
          </View>
          {mode === "up" && <Field label="Volledige naam" value={name} onChangeText={setName} autoComplete="name" />}
          <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Wachtwoord" value={pw} onChangeText={setPw} secureTextEntry autoComplete={mode === "in" ? "current-password" : "new-password"} />
          {err ? <Text style={{ color: c.bad, fontFamily: f.sans, marginBottom: 14 }}>{err}</Text> : null}
          <Btn solid label={mode === "in" ? "Binnenkomen" : "Aanvraag starten"} onPress={submit} loading={busy} disabled={!ok} />
          <Text onPress={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }} style={{ color: c.gold, fontFamily: f.sans, textAlign: "center", marginTop: 24 }}>
            {mode === "in" ? "Nog geen lid? Vraag toegang aan" : "Al lid? Log in"}
          </Text>
          {isDemo && (
            <Text style={{ color: c.muted, fontFamily: f.sans, fontSize: 12, textAlign: "center", marginTop: 28, lineHeight: 18 }}>
              Demo-modus: elk e-mailadres werkt. Gebruik een adres met “admin” (bv. admin@verum.nl) voor het beheerpaneel.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Backdrop>
  );
}
