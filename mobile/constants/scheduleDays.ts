/** day_of_week: 0 = Sunday … 6 = Saturday (matches backend + JS Date.getDay()). */
export const WEEKDAYS = [
  { dow: 1, label: "Monday", short: "Mon" },
  { dow: 2, label: "Tuesday", short: "Tue" },
  { dow: 3, label: "Wednesday", short: "Wed" },
  { dow: 4, label: "Thursday", short: "Thu" },
  { dow: 5, label: "Friday", short: "Fri" },
  { dow: 6, label: "Saturday", short: "Sat" },
  { dow: 0, label: "Sunday", short: "Sun" },
] as const;

export function dayLabel(dow: number): string {
  return WEEKDAYS.find((d) => d.dow === dow)?.label ?? `Day ${dow}`;
}

export function dayShort(dow: number): string {
  return WEEKDAYS.find((d) => d.dow === dow)?.short ?? "?";
}
