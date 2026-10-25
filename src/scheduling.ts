import { calendarDate } from "./invoices";
export type Hours = {
  opening: string;
  closing: string;
  closed_weekdays: string;
  break_start?: string;
  break_end?: string;
  id?: string;
  name?: string;
};
export function minutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
export function clock(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function quarterSlots(start: string, duration: number, buffer: number) {
  return Array.from({ length: Math.ceil((duration + buffer) / 15) }, (_, i) =>
    clock(minutes(start) + i * 15),
  );
}
export async function availability(
  db: D1Database,
  date: string,
  timezone: string,
  serviceId?: string,
) {
  calendarDate.parse(date);
  const settings = await db
    .prepare("SELECT * FROM salon_settings WHERE id=1")
    .first<Hours & { minimum_notice_minutes: number }>();
  const service = serviceId
    ? await db
        .prepare(
          "SELECT duration_minutes,buffer_minutes FROM services WHERE id=? AND active=1",
        )
        .bind(serviceId)
        .first<{ duration_minutes: number; buffer_minutes: number }>()
    : { duration_minutes: 60, buffer_minutes: 0 };
  if (!settings || !service) throw new Error("Package unavailable");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const notice =
    Number(parts.hour) * 60 +
    Number(parts.minute) +
    settings.minimum_notice_minutes;
  const days = (Date.parse(date) - Date.parse(today)) / 86400000;
  const weekday = String(new Date(date + "T12:00:00Z").getUTCDay());
  if (
    days < 0 ||
    days > 90 ||
    settings.closed_weekdays.split(",").includes(weekday) ||
    (await db
      .prepare("SELECT date FROM salon_closures WHERE date=?")
      .bind(date)
      .first())
  )
    return { slots: [], options: [], timezone };
  const [groomers, occupied] = await Promise.all([
    db
      .prepare("SELECT * FROM groomers WHERE active=1 ORDER BY name")
      .all<Hours & { id: string; name: string }>(),
    db
      .prepare("SELECT slot,groomer_id FROM booking_occupancy WHERE date=?")
      .bind(date)
      .all<{ slot: string; groomer_id: string }>(),
  ]);
  const options: { slot: string; groomerId: string; groomerName: string }[] =
    [];
  for (const g of groomers.results) {
    if (g.closed_weekdays.split(",").includes(weekday)) continue;
    const start = Math.max(minutes(settings.opening), minutes(g.opening)),
      end = Math.min(minutes(settings.closing), minutes(g.closing));
    for (
      let n = Math.ceil(start / 15) * 15;
      n + service.duration_minutes + service.buffer_minutes <= end;
      n += 15
    ) {
      if (days * 1440 + n < notice) continue;
      if (
        g.break_start &&
        g.break_end &&
        n < minutes(g.break_end) &&
        n + service.duration_minutes + service.buffer_minutes >
          minutes(g.break_start)
      )
        continue;
      const slot = clock(n),
        blocks = quarterSlots(
          slot,
          service.duration_minutes,
          service.buffer_minutes,
        );
      if (
        blocks.some((s) =>
          occupied.results.some((o) => o.groomer_id === g.id && o.slot === s),
        )
      )
        continue;
      options.push({ slot, groomerId: g.id, groomerName: g.name });
    }
  }
  return {
    slots: [...new Set(options.map((o) => o.slot))].sort(),
    options,
    timezone,
  };
}
