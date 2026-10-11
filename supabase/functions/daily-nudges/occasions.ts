// Calendar moments the daily-nudges function can tie a proactive message to.
// Pure date math, no network, so it is easy to test and has no per-year
// upkeep: every date is derived from the current date.

export type Occasion = {
  key: string;
  nl: string;
  en: string;
  daysAway: number; // 0 = today
  idea: string; // what a concierge could offer around it, kept generic on purpose
};

// "Today" as a calendar date in Amsterdam, independent of the server's zone.
export function amsterdamDate(now: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), weekday: weekdays.indexOf(get('weekday')) };
}

const DAY = 24 * 60 * 60 * 1000;

function utcDay(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d);
}

// Nth weekday (0 = Sunday) of a month, e.g. 2nd Sunday of May.
function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const offset = (weekday - first + 7) % 7;
  return utcDay(y, m, 1 + offset + (n - 1) * 7);
}

// Western Easter Sunday (anonymous Gregorian algorithm).
function easterSunday(y: number): number {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return utcDay(y, month, day);
}

export function upcomingOccasions(now: Date): Occasion[] {
  const t = amsterdamDate(now);
  const today = utcDay(t.y, t.m, t.d);
  const out: Occasion[] = [];

  // [key, nl, en, idea, date-in-ms, how many days ahead we may mention it]
  const candidates: Array<[string, string, string, string, number, number]> = [];
  for (const y of [t.y, t.y + 1]) {
    const easter = easterSunday(y);
    candidates.push(
      ['valentines', 'Valentijnsdag', "Valentine's Day", 'a romantic dinner reservation or a night away', utcDay(y, 2, 14), 5],
      ['kings_day', 'Koningsdag', "King's Day", 'a table for lunch or dinner, or a boat day in Amsterdam', utcDay(y, 4, 27), 4],
      ['good_friday', 'het paasweekend', 'the Easter weekend', 'a weekend away or a long Easter lunch', easter - 2 * DAY, 4],
      ['mothers_day', 'Moederdag', "Mother's Day", 'a brunch or dinner table, or a short stay for the family', nthWeekday(y, 5, 0, 2), 5],
      ['fathers_day', 'Vaderdag', "Father's Day", 'a dinner table or a day out', nthWeekday(y, 6, 0, 3), 5],
      ['christmas', 'de kerstdagen', 'Christmas', 'a Christmas dinner table or a winter stay', utcDay(y, 12, 24), 7],
      ['new_years_eve', 'oud en nieuw', "New Year's Eve", 'a table for the evening or a hotel stay', utcDay(y, 12, 31), 7],
    );
  }
  for (const [key, nl, en, idea, date, window] of candidates) {
    const daysAway = Math.round((date - today) / DAY);
    if (daysAway >= 0 && daysAway <= window) out.push({ key, nl, en, daysAway, idea });
  }

  // Every Friday: the weekend is about to start.
  if (t.weekday === 5) {
    out.push({ key: 'friday_weekend', nl: 'het weekend', en: 'the weekend', daysAway: 0, idea: 'a table for tonight or tomorrow, a night out, or a spontaneous weekend away' });
  }
  // Thursday evening planners: mention it one day ahead so a booking is realistic.
  if (t.weekday === 4) {
    out.push({ key: 'thursday_weekend', nl: 'het komende weekend', en: 'the coming weekend', daysAway: 1, idea: 'a weekend away or a table booked ahead' });
  }

  return out.sort((a, b) => a.daysAway - b.daysAway);
}

// Copy rules the member-facing text must always follow, applied after the
// model has written it, so a stray em dash or emoji can never ship.
export function cleanCopy(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}
