import { CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { Inter_400Regular, Inter_500Medium, useFonts } from "@expo-google-fonts/inter";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth";
import { c } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { me, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const top = segments[0] as string | undefined;

  useEffect(() => {
    if (!ready) return;
    // Lid -> juiste scherm voor zijn status; niet ingelogd -> login.
    const want = !me ? "login" : me.status === "onboarding" ? "onboarding" : me.status === "active" ? "(tabs)" : "pending";
    const ok = want === "(tabs)" ? top === "(tabs)" || top === "event" : top === want;
    if (!ok) router.replace(want === "(tabs)" ? "/" : (`/${want}` as never));
  }, [ready, me, top, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.ink }, animation: "fade" }}>
      <Stack.Screen name="event/[id]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

export default function Root() {
  const [loaded] = useFonts({ CormorantGaramond_500Medium, CormorantGaramond_600SemiBold, Inter_400Regular, Inter_500Medium });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider><Gate /></AuthProvider>
    </SafeAreaProvider>
  );
}
