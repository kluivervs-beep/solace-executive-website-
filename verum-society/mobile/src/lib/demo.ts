import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Message, Profile, Rsvp, VEvent } from "./types";

// Demo-modus: alles leeft in AsyncStorage, zodat je de app kunt bekijken zonder backend.
export interface DemoDB {
  me: string | null;
  profiles: Profile[];
  events: VEvent[];
  rsvps: Rsvp[];
  messages: Message[];
}

const KEY = "verum-demo-v1";

const day = 86400000;
const at = (d: number, h: number) => {
  const t = new Date(Date.now() + d * day);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};
const person = (id: string, name: string, status: Profile["status"] = "active"): Profile => ({
  id,
  email: `${id}@verum.demo`,
  full_name: name,
  role: "member",
  status,
  questionnaire:
    status === "pending"
      ? {
          brings: "Ik kook en regel de muziek op diners.",
          interests: ["Wijn", "Fine dining"],
          expertise: "Sommelier-opleiding",
          why: "Ik mis een plek met mensen die echt iets met elkaar willen doen.",
          dietary: "Geen",
          instagram: "@" + id,
        }
      : null,
  created_at: new Date().toISOString(),
});

function seed(): DemoDB {
  return {
    me: null,
    profiles: [
      person("sofia", "Sofia van Dijk"),
      person("jamal", "Jamal Ouazzani"),
      person("lotte", "Lotte Bakker"),
      person("max", "Max de Wit"),
      person("noor", "Noor Haddad", "pending"),
      person("tim", "Tim Verhoeven", "pending"),
    ],
    events: [
      {
        id: "e1",
        title: "Blind Wijn Proeverij: Oude vs. Nieuwe Wereld",
        description:
          "Zes wijnen, geen etiketten. Een sommelier begeleidt de avond, daarna een lange tafel met kleine gerechten. Wie het meeste raadt wint een fles uit de kelder.",
        kind: "proeverij",
        starts_at: at(6, 19),
        location: "Privé-kelder, Amsterdam (adres na bevestiging)",
        capacity: 24,
        price_eur: 65,
      },
      {
        id: "e2",
        title: "Verum Nights: Opening Party",
        description:
          "Dresscode: black & gold. Live saxofoon, signature cocktails en een DJ tot de ochtend. Alleen op de gastenlijst.",
        kind: "feest",
        starts_at: at(13, 22),
        location: "Geheime locatie, Amsterdam",
        capacity: 120,
        price_eur: null,
      },
      {
        id: "e3",
        title: "Chef's Table: zeven gangen",
        description:
          "Een gastchef kookt zeven gangen voor één lange tafel van twaalf. Wijnarrangement inbegrepen.",
        kind: "diner",
        starts_at: at(21, 19),
        location: "Rotterdam",
        capacity: 12,
        price_eur: 145,
      },
      {
        id: "e4",
        title: "Weekend Marbella",
        description:
          "Villa, boottocht, sunset dinner en een clubnacht. Vertrek vrijdag, terug zondag. Vluchten regelt iedereen zelf.",
        kind: "trip",
        starts_at: at(45, 10),
        location: "Marbella, Spanje",
        capacity: 16,
        price_eur: 420,
      },
    ],
    rsvps: [
      { event_id: "e1", user_id: "sofia", status: "going" },
      { event_id: "e1", user_id: "jamal", status: "going" },
      { event_id: "e1", user_id: "lotte", status: "maybe" },
      { event_id: "e2", user_id: "sofia", status: "going" },
      { event_id: "e2", user_id: "max", status: "going" },
      { event_id: "e2", user_id: "lotte", status: "going" },
      { event_id: "e3", user_id: "jamal", status: "going" },
    ],
    messages: [
      { id: "m1", room: "lounge", user_id: "sofia", author_name: "Sofia van Dijk", body: "Welkom allemaal. Ik ben benieuwd naar de blind proeverij 🍷", created_at: at(-1, 20) },
      { id: "m2", room: "lounge", user_id: "jamal", author_name: "Jamal Ouazzani", body: "Ik neem een paar flessen uit Piemonte mee om te vergelijken.", created_at: at(-1, 21) },
      { id: "m3", room: "events", user_id: "max", author_name: "Max de Wit", body: "Iemand nog plek in de auto vanuit Utrecht naar de opening?", created_at: at(0, 9) },
    ],
  };
}

export async function loadDemo(): Promise<DemoDB> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const db = seed();
  await saveDemo(db);
  return db;
}

export async function saveDemo(db: DemoDB) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(db));
  } catch {}
}
