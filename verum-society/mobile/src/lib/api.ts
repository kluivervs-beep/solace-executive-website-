import { supabase, isDemo } from "./supabase";
import { loadDemo, saveDemo } from "./demo";
import type { Message, MemberStatus, Profile, Questionnaire, Rsvp, RsvpStatus, VEvent } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

// ---------- auth ----------

export async function getProfile(): Promise<Profile | null> {
  if (isDemo) {
    const db = (await loadDemo());
    return db.profiles.find((p) => p.id === db.me) ?? null;
  }
  const { data: s } = await supabase!.auth.getSession();
  if (!s.session) return null;
  const { data, error } = await supabase!.from("profiles").select("*").eq("id", s.session.user.id).single();
  fail(error);
  return data as Profile;
}

export async function signUp(email: string, password: string, fullName: string) {
  if (isDemo) {
    const db = (await loadDemo());
    if (db.profiles.some((p) => p.email === email)) throw new Error("Dit e-mailadres bestaat al.");
    const id = uid();
    // Demo: een e-mail met "admin" wordt direct beheerder en actief, zodat je alles kunt testen.
    const admin = email.toLowerCase().includes("admin");
    db.profiles.push({
      id, email, full_name: fullName,
      role: admin ? "admin" : "member",
      status: admin ? "active" : "onboarding",
      questionnaire: null,
      created_at: new Date().toISOString(),
    });
    db.me = id;
    await saveDemo(db);
    return;
  }
  const { error } = await supabase!.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  fail(error);
}

export async function signIn(email: string, password: string) {
  if (isDemo) {
    const db = (await loadDemo());
    const p = db.profiles.find((x) => x.email === email);
    if (!p) throw new Error("Onbekend e-mailadres. Maak eerst een account aan.");
    db.me = p.id;
    await saveDemo(db);
    return;
  }
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  fail(error);
}

export async function signOut() {
  if (isDemo) {
    const db = (await loadDemo());
    db.me = null;
    await saveDemo(db);
    return;
  }
  await supabase!.auth.signOut();
}

export async function saveQuestionnaire(q: Questionnaire) {
  if (isDemo) {
    const db = (await loadDemo());
    const me = db.profiles.find((p) => p.id === db.me);
    if (!me) return;
    me.questionnaire = q;
    me.status = "pending";
    await saveDemo(db);
    return;
  }
  const { data: s } = await supabase!.auth.getSession();
  const { error } = await supabase!
    .from("profiles")
    .update({ questionnaire: q, status: "pending" })
    .eq("id", s.session!.user.id);
  fail(error);
}

// ---------- events ----------

export async function listEvents(): Promise<VEvent[]> {
  if (isDemo) return [...(await loadDemo()).events].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const { data, error } = await supabase!.from("events").select("*").order("starts_at");
  fail(error);
  return data as VEvent[];
}

export async function getEvent(id: string): Promise<VEvent | null> {
  return (await listEvents()).find((e) => e.id === id) ?? null;
}

export async function listRsvps(eventId?: string): Promise<Rsvp[]> {
  if (isDemo) {
    const db = (await loadDemo());
    return db.rsvps
      .filter((r) => !eventId || r.event_id === eventId)
      .map((r) => ({ ...r, full_name: db.profiles.find((p) => p.id === r.user_id)?.full_name }));
  }
  let q = supabase!.from("rsvps").select("event_id,user_id,status,profiles(full_name)");
  if (eventId) q = q.eq("event_id", eventId);
  const { data, error } = await q;
  fail(error);
  return (data as unknown as (Rsvp & { profiles: { full_name: string } | null })[]).map((r) => ({
    event_id: r.event_id, user_id: r.user_id, status: r.status, full_name: r.profiles?.full_name,
  }));
}

export async function setRsvp(eventId: string, userId: string, status: RsvpStatus) {
  if (isDemo) {
    const db = (await loadDemo());
    const ex = db.rsvps.find((r) => r.event_id === eventId && r.user_id === userId);
    if (ex) ex.status = status;
    else db.rsvps.push({ event_id: eventId, user_id: userId, status });
    await saveDemo(db);
    return;
  }
  const { error } = await supabase!.from("rsvps").upsert({ event_id: eventId, user_id: userId, status });
  fail(error);
}

// ---------- admin ----------

export async function listMembers(): Promise<Profile[]> {
  if (isDemo) return (await loadDemo()).profiles;
  const { data, error } = await supabase!.from("profiles").select("*").order("created_at", { ascending: false });
  fail(error);
  return data as Profile[];
}

export async function setMemberStatus(id: string, status: MemberStatus) {
  if (isDemo) {
    const db = (await loadDemo());
    const p = db.profiles.find((x) => x.id === id);
    if (p) p.status = status;
    await saveDemo(db);
    return;
  }
  const { error } = await supabase!.from("profiles").update({ status }).eq("id", id);
  fail(error);
}

export async function createEvent(e: Omit<VEvent, "id">) {
  if (isDemo) {
    const db = (await loadDemo());
    db.events.push({ ...e, id: uid() });
    await saveDemo(db);
    return;
  }
  const { error } = await supabase!.from("events").insert(e);
  fail(error);
}

export async function deleteEvent(id: string) {
  if (isDemo) {
    const db = (await loadDemo());
    db.events = db.events.filter((e) => e.id !== id);
    db.rsvps = db.rsvps.filter((r) => r.event_id !== id);
    await saveDemo(db);
    return;
  }
  const { error } = await supabase!.from("events").delete().eq("id", id);
  fail(error);
}

// ---------- chat ----------

export async function listMessages(room: string): Promise<Message[]> {
  if (isDemo) {
    return (await loadDemo()).messages.filter((m) => m.room === room).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const { data, error } = await supabase!
    .from("messages").select("*").eq("room", room).order("created_at", { ascending: false }).limit(200);
  fail(error);
  return (data as Message[]).reverse();
}

export async function sendMessage(room: string, me: Profile, body: string) {
  if (isDemo) {
    const db = (await loadDemo());
    db.messages.push({
      id: uid(), room, user_id: me.id, author_name: me.full_name, body, created_at: new Date().toISOString(),
    });
    await saveDemo(db);
    demoBus.forEach((f) => f());
    return;
  }
  const { error } = await supabase!.from("messages").insert({ room, user_id: me.id, author_name: me.full_name, body });
  fail(error);
}

const demoBus = new Set<() => void>();

/** Roept `onChange` aan bij nieuwe berichten; geeft een unsubscribe-functie terug. */
export function subscribeMessages(room: string, onChange: () => void): () => void {
  if (isDemo) {
    demoBus.add(onChange);
    return () => { demoBus.delete(onChange); };
  }
  const ch = supabase!
    .channel(`room-${room}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room=eq.${room}` }, onChange)
    .subscribe();
  return () => {
    supabase!.removeChannel(ch);
  };
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("nl-NL", { day: "numeric" }),
    month: d.toLocaleDateString("nl-NL", { month: "short" }).replace(".", ""),
    weekday: d.toLocaleDateString("nl-NL", { weekday: "long" }),
    time: d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }),
    full: d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  };
}

// ---------- App Store-eisen: account verwijderen + berichten melden ----------

export async function deleteAccount() {
  if (isDemo) {
    const db = await loadDemo();
    const id = db.me;
    db.profiles = db.profiles.filter((p) => p.id !== id);
    db.rsvps = db.rsvps.filter((r) => r.user_id !== id);
    db.messages = db.messages.filter((m) => m.user_id !== id);
    db.me = null;
    await saveDemo(db);
    return;
  }
  const { error } = await supabase!.rpc("delete_my_account");
  fail(error);
  await supabase!.auth.signOut();
}

export async function reportMessage(messageId: string, reporterId: string, reason: string) {
  if (isDemo) return;
  const { error } = await supabase!.from("reports").insert({ message_id: messageId, reporter_id: reporterId, reason });
  fail(error);
}
