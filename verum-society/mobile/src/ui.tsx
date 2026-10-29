import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { c, f } from "./theme";

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[s.eyebrow, style as object]}>{String(children).toUpperCase()}</Text>;
}

export function H({ children, size = 34, gold, style }: { children: ReactNode; size?: number; gold?: boolean; style?: object }) {
  return <Text style={[{ fontFamily: f.serif, fontSize: size, lineHeight: size * 1.12, color: gold ? c.goldHi : c.cream }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[{ fontFamily: f.sans, fontSize: 15, lineHeight: 23, color: muted ? c.muted : c.cream }, style]}>{children}</Text>;
}

export function Btn({
  label, onPress, solid, small, danger, on, disabled, loading, style,
}: {
  label: string; onPress: () => void; solid?: boolean; small?: boolean; danger?: boolean; on?: boolean;
  disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const filled = solid || on;
  const inner = (
    <View style={[s.btn, small && s.btnSm, !filled && { borderWidth: 1, borderColor: danger ? c.bad : c.gold }]}>
      {loading ? <ActivityIndicator color={filled ? "#1a1208" : c.goldHi} /> : (
        <Text style={[s.btnTxt, small && { fontSize: 11 }, { color: filled ? "#1a1208" : danger ? c.bad : c.goldHi }]}>{label.toUpperCase()}</Text>
      )}
    </View>
  );
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style]}
    >
      {filled ? <LinearGradient colors={[c.gold, "#a8873f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 3 }}>{inner}</LinearGradient> : inner}
    </Pressable>
  );
}

export function Field({ label, hint, ...p }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      {hint ? <Text style={{ color: c.muted, fontFamily: f.sans, fontSize: 12, marginBottom: 6 }}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor="#6e645d"
        style={[s.input, p.multiline && { minHeight: 100, textAlignVertical: "top" }]}
        {...p}
      />
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={[s.chip, on && { backgroundColor: "rgba(201,169,106,0.16)", borderColor: c.gold }]}>
      <Text style={{ color: on ? c.goldHi : c.muted, fontFamily: f.sans, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Rule() {
  return <LinearGradient colors={["transparent", c.gold, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1, opacity: 0.5, marginVertical: 24 }} />;
}

/** Achtergrond met wijnrode gloed, voor elk scherm. */
export function Backdrop({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <LinearGradient colors={["rgba(122,28,51,0.34)", "transparent"]} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.45 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient colors={["transparent", "rgba(122,28,51,0.2)"]} start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow: { color: c.gold, fontFamily: f.sansMed, fontSize: 11, letterSpacing: 3.2 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", borderRadius: 3 },
  btnSm: { paddingVertical: 9, paddingHorizontal: 14 },
  btnTxt: { fontFamily: f.sansMed, fontSize: 12, letterSpacing: 2.4 },
  label: { color: c.gold, fontFamily: f.sansMed, fontSize: 11, letterSpacing: 2.6, marginBottom: 8 },
  input: { color: c.cream, fontFamily: f.sans, fontSize: 16, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: c.lineSoft, borderBottomColor: c.line, borderRadius: 3, paddingHorizontal: 14, paddingVertical: 13 },
  chip: { borderWidth: 1, borderColor: c.lineSoft, borderRadius: 99, paddingVertical: 8, paddingHorizontal: 16, marginRight: 8, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: c.lineSoft, backgroundColor: "rgba(27,19,23,0.85)", borderRadius: 6, padding: 20 },
});
