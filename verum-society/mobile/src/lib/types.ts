export type Role = "member" | "admin";
export type MemberStatus = "onboarding" | "pending" | "active" | "suspended";
export type EventKind = "feest" | "diner" | "trip" | "proeverij" | "activiteit";
export type RsvpStatus = "going" | "maybe" | "declined";

export interface Questionnaire {
  brings: string;
  interests: string[];
  expertise: string;
  why: string;
  dietary: string;
  instagram: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: MemberStatus;
  questionnaire: Questionnaire | null;
  created_at: string;
}

export interface VEvent {
  id: string;
  title: string;
  description: string;
  kind: EventKind;
  starts_at: string;
  location: string;
  capacity: number | null;
  price_eur: number | null;
}

export interface Rsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  full_name?: string;
}

export interface Message {
  id: string;
  room: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export const ROOMS = [
  { id: "lounge", name: "The Lounge", blurb: "Alles en niets, tussen leden" },
  { id: "events", name: "Aankomend", blurb: "Plannen, lifts, wie neemt wat mee" },
  { id: "trips", name: "Trips & Reizen", blurb: "Waar gaan we heen" },
] as const;

export const KIND_LABEL: Record<EventKind, string> = {
  feest: "Feest",
  diner: "Diner",
  trip: "Trip",
  proeverij: "Proeverij",
  activiteit: "Activiteit",
};

export const INTEREST_OPTIONS = [
  "Wijn",
  "Fine dining",
  "Reizen",
  "Muziek & feesten",
  "Kunst",
  "Sport & padel",
  "Mode",
  "Ondernemen",
  "Cocktails",
  "Fotografie",
];
