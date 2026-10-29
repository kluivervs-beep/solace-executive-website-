import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useAuth } from "@/auth";
import { c, f } from "@/theme";

export default function TabsLayout() {
  const { me } = useAuth();
  if (!me) return null; // uitgelogd: scherm leeg tot de redirect naar login klaar is
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: any; size: number }) => <Ionicons name={name} size={size - 2} color={color} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.goldHi,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: "rgba(14,9,12,0.97)", borderTopColor: c.line, borderTopWidth: 1 },
        tabBarLabelStyle: { fontFamily: f.sansMed, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase" },
        sceneStyle: { backgroundColor: c.ink },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: icon("chatbubble-ellipses-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Profiel", tabBarIcon: icon("person-outline") }} />
      <Tabs.Screen name="admin" options={{ title: "Beheer", tabBarIcon: icon("shield-checkmark-outline"), href: me.role === "admin" ? undefined : null }} />
    </Tabs>
  );
}
