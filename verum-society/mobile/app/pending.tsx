import { Text, View } from "react-native";
import { useAuth } from "@/auth";
import { Mark } from "@/Mark";
import { signOut } from "@/lib/api";
import { c, f } from "@/theme";
import { Backdrop, Body, Eyebrow, H, Rule } from "@/ui";

export default function Pending() {
  const { me, refresh } = useAuth();
  const waiting = me?.status === "pending";
  return (
    <Backdrop>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Mark size={60} />
        <Eyebrow style={{ marginTop: 28 }}>{waiting ? "Aanvraag in behandeling" : "Toegang geblokkeerd"}</Eyebrow>
        <H size={34} style={{ textAlign: "center", marginTop: 12 }}>
          {waiting ? `Dank je, ${me?.full_name.split(" ")[0]}.` : "Je lidmaatschap is gepauzeerd."}
        </H>
        <Body muted style={{ textAlign: "center", marginTop: 14 }}>
          {waiting
            ? "We lezen je antwoorden en activeren je account persoonlijk. Je hoort van ons zodra je binnen bent."
            : "Neem contact op met het Verum-team."}
        </Body>
        <Rule />
        <Text onPress={refresh} style={{ color: c.goldHi, fontFamily: f.sansMed, letterSpacing: 2.4, fontSize: 12, marginBottom: 22 }}>CONTROLEER STATUS</Text>
        <Text onPress={async () => { await signOut(); await refresh(); }} style={{ color: c.muted, fontFamily: f.sans }}>Uitloggen</Text>
      </View>
    </Backdrop>
  );
}
