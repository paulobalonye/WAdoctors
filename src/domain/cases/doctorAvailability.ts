type DailyWindow = {
  start: string;
  end: string;
};

type WeeklyAvailability = Partial<
  Record<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday", DailyWindow>
>;

function normalizeWeekday(date: Date): keyof WeeklyAvailability {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "America/New_York"
  })
    .format(date)
    .toLowerCase();

  return day as keyof WeeklyAvailability;
}

function hourMinuteInNewYork(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York"
  }).formatToParts(date);

  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

function parseTimeToMinutes(timeText: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

export function isDoctorAvailableNow(availability: unknown, now = new Date()): boolean {
  if (!availability || typeof availability !== "object") {
    return true;
  }

  const weekly = availability as WeeklyAvailability;
  const day = normalizeWeekday(now);
  const window = weekly[day];

  if (!window) {
    return false;
  }

  const start = parseTimeToMinutes(window.start);
  const end = parseTimeToMinutes(window.end);

  if (start === null || end === null) {
    return false;
  }

  const currentMinute = hourMinuteInNewYork(now);
  return currentMinute >= start && currentMinute <= end;
}

export function defaultDoctorAvailability(): WeeklyAvailability {
  return {
    monday: { start: "09:00", end: "17:00" },
    tuesday: { start: "09:00", end: "17:00" },
    wednesday: { start: "09:00", end: "17:00" },
    thursday: { start: "09:00", end: "17:00" },
    friday: { start: "09:00", end: "17:00" }
  };
}
