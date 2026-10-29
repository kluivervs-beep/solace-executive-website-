import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/auth";
import { listMessages, reportMessage, sendMessage, subscribeMessages } from "@/lib/api";
import { Message, ROOMS } from "@/lib/types";
import { c, f } from "@/theme";
import { Backdrop, Body, Btn, Eyebrow, H } from "@/ui";

export default function Chat() {
  const me = useMe();
  const inset = useSafeAreaInsets();
  const [room, setRoom] = useState<string>(ROOMS[0].id);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const list = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => setMsgs(await listMessages(room)), [room]);
  useEffect(() => { load(); return subscribeMessages(room, load); }, [room, load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    await sendMessage(room, me, body);
    load();
  };
  const report = (m: Message) =>
    Alert.alert("Bericht melden?", "Het Verum-team bekijkt dit bericht.", [
      { text: "Annuleer", style: "cancel" },
      { text: "Meld", style: "destructive", onPress: async () => { await reportMessage(m.id, me.id, "ongepast"); Alert.alert("Bedankt", "We kijken ernaar."); } },
    ]);
  const cur = ROOMS.find((r) => r.id === room)!;

  return (
    <Backdrop>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
        <View style={{ paddingTop: inset.top + 20, paddingHorizontal: 22 }}>
          <Eyebrow>Alleen voor leden</Eyebrow>
          <H size={32} style={{ marginTop: 6, marginBottom: 14 }}>Chat</H>
        </View>
        <View style={{ height: 62 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 8 }}>
            {ROOMS.map((r) => (
              <Pressable key={r.id} onPress={() => setRoom(r.id)}
                style={{ borderWidth: 1, borderColor: r.id === room ? c.gold : c.lineSoft, backgroundColor: r.id === room ? "rgba(201,169,106,0.08)" : "transparent", borderRadius: 4, paddingVertical: 8, paddingHorizontal: 16, justifyContent: "center" }}>
                <Text style={{ fontFamily: f.serif, fontSize: 18, color: c.cream }}>{r.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <FlatList
          ref={list}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 22, gap: 14, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Body muted style={{ textAlign: "center", marginTop: 60 }}>{`Stil in ${cur.name}. Begin het gesprek.`}</Body>}
          renderItem={({ item: m }) => {
            const mine = m.user_id === me.id;
            return (
              <Pressable onLongPress={mine ? undefined : () => report(m)} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                <Text style={{ fontFamily: f.sansMed, fontSize: 10, letterSpacing: 1.6, color: c.gold, marginBottom: 3, textAlign: mine ? "right" : "left" }}>
                  {(mine ? "JIJ" : m.author_name.toUpperCase()) + "  "}
                  <Text style={{ color: c.muted, letterSpacing: 0 }}>{new Date(m.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</Text>
                </Text>
                <View style={{ backgroundColor: mine ? c.wine : c.surface2, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderTopLeftRadius: mine ? 14 : 2, borderTopRightRadius: mine ? 2 : 14 }}>
                  <Text style={{ color: c.cream, fontFamily: f.sans, fontSize: 15, lineHeight: 21 }}>{m.body}</Text>
                </View>
              </Pressable>
            );
          }}
        />
        <View style={{ flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: c.lineSoft }}>
          <TextInput
            value={text} onChangeText={setText} onSubmitEditing={send} maxLength={2000} returnKeyType="send"
            placeholder={`Bericht in ${cur.name}…`} placeholderTextColor="#6e645d"
            style={{ flex: 1, minWidth: 0, color: c.cream, fontFamily: f.sans, fontSize: 16, borderWidth: 1, borderColor: c.lineSoft, borderRadius: 3, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.03)" }}
          />
          <Btn solid label="Stuur" onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </Backdrop>
  );
}
