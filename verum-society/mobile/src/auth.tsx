import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getProfile } from "./lib/api";
import { isDemo, supabase } from "./lib/supabase";
import type { Profile } from "./lib/types";

interface Ctx { me: Profile | null; ready: boolean; refresh: () => Promise<void>; }
const AuthCtx = createContext<Ctx>({ me: null, ready: false, refresh: async () => {} });
export const useAuth = () => useContext(AuthCtx);
/** Voor schermen die alleen bestaan als je ingelogd bent. */
export const useMe = () => useContext(AuthCtx).me!;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try { setMe(await getProfile()); } catch { setMe(null); }
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    if (isDemo) return;
    const { data } = supabase!.auth.onAuthStateChange(() => { refresh(); });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  return <AuthCtx.Provider value={{ me, ready, refresh }}>{children}</AuthCtx.Provider>;
}
