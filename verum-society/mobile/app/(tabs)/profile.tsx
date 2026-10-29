import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useMe } from "@/auth";
import { deleteAccount, signOut } from "@/lib/api";
import { c, f } from "@/theme";
import { Backdrop, Body, Btn, Card, Eyebrow, H, Rule } from "@/ui";

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={{ marginTop: 14 }}>
    <Text style={{ color: c.gold, fontFamily: f.sansMed, fontSize: 10, letterSpacing: 2.4 }}>{k.toUpperCase()}</Text>
    <Body>{v || "-"}</Body>
  </View>
);

export default function Profile() {
  const me = useMe();
  const { refresh } = useAuth();
  const inset = useSafeAreaInsets();
  const q = me.questionnaire;
  const remove = () => {
    const run = async () => { await deleteAccount(); await refresh(); };
    const msg = "Je account en al je gegevens worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.";
    if (Platform.OS === "web") { if (window.confirm(msg)) run(); return; }
    Alert.alert("Account verwijderen?", msg, [{ text: "Annuleer", style: "cancel" }, { text: "Verwijder", style: "destructive", onPress: run }]);
  };
  return (
    <Backdrop>
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: inset.top + 24, paddingBottom: 40 }}>
        <Eyebrow>{me.role === "admin" ? "Beheerder" : "Lid"} van Verum Society</Eyebrow>
        <H size={36} style={{ marginTop: 8 }}>{me.full_name}</H>
        <Body muted style={{ marginTop: 4 }}>{me.email}</Body>
        <Rule />
        {q ? (
          <Card>
            <Row k="Wat ik breng" v={q.brings} />
            <Row k="Expertise" v={q.expertise} />
            <Row k="Interesses" v={q.interests.join(" · ")} />
            <Row k="Dieet" v={q.dietary} />
            {q.instagram ? <Row k="Instagram" v={q.instagram} /> : null}
          </Card>
        ) : <Body muted>Geen vragenlijst ingevuld.</Body>}
        <View style={{ marginTop: 28 }}><Btn label="Uitloggen" onPress={async () => { await signOut(); await refresh(); }} /></View>
        <Text onPress={remove} style={{ color: c.bad, fontFamily: f.sans, textAlign: "center", marginTop: 32, fontSize: 13 }}>Account verwijderen</Text>
      </ScrollView>
    </Backdrop>
  );
}
