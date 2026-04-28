type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const weekdayOrder: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

type DailyWindow = {
  start: string;
  end: string;
};

type WeeklyDayValue = DailyWindow | DailyWindow[];
type WeeklyAvailability = Partial<Record<Weekday, WeeklyDayValue>>;

type HolidayOverride = {
  date: string;
  isOff?: boolean;
  windows?: WeeklyDayValue;
};

type AvailabilityConfig = {
  timezone?: string;
  weekly?: WeeklyAvailability;
  holidays?: HolidayOverride[];
};

type ParsedAvailability = {
  timezone: string;
  weekly: WeeklyAvailability;
  holidays: HolidayOverride[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isWeekdayKey(value: string): value is Weekday {
  return weekdayOrder.includes(value as Weekday);
}

function normalizeTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "America/New_York";
  }

  const candidate = value.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "America/New_York";
  }
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

function normalizeWeekday(date: Date, timeZone: string): Weekday | null {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone
  })
    .format(date)
    .toLowerCase();

  return isWeekdayKey(day) ? day : null;
}

function localDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function hourMinuteInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  }).formatToParts(date);

  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

function normalizeDailyWindow(input: unknown): DailyWindow | null {
  if (!isRecord(input)) {
    return null;
  }

  const start = typeof input.start === "string" ? input.start.trim() : "";
  const end = typeof input.end === "string" ? input.end.trim() : "";
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) {
    return null;
  }

  return {
    start,
    end
  };
}

function normalizeDailyWindows(input: unknown): DailyWindow[] | null {
  if (Array.isArray(input)) {
    if (!input.length) {
      return [];
    }

    const windows: DailyWindow[] = [];
    for (const item of input) {
      const parsed = normalizeDailyWindow(item);
      if (!parsed) {
        return null;
      }
      windows.push(parsed);
    }
    return windows;
  }

  const single = normalizeDailyWindow(input);
  return single ? [single] : null;
}

function normalizeWeeklyAvailability(raw: unknown): WeeklyAvailability | null {
  if (!isRecord(raw)) {
    return null;
  }

  const weekly: WeeklyAvailability = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = key.trim().toLowerCase();
    if (!isWeekdayKey(normalizedKey)) {
      continue;
    }

    const windows = normalizeDailyWindows(value);
    if (!windows) {
      return null;
    }
    if (!windows.length) {
      continue;
    }

    weekly[normalizedKey] = windows;
  }

  return weekly;
}

function normalizeHolidayOverrides(raw: unknown): HolidayOverride[] | null {
  if (!Array.isArray(raw)) {
    return [];
  }

  const holidays: HolidayOverride[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      return null;
    }

    const date = typeof item.date === "string" ? item.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return null;
    }

    const isOff = item.isOff === true;
    const hasWindows = Object.prototype.hasOwnProperty.call(item, "windows");
    let windows: DailyWindow[] | undefined;
    if (hasWindows) {
      const parsedWindows = normalizeDailyWindows(item.windows);
      if (!parsedWindows) {
        return null;
      }
      windows = parsedWindows;
    }

    holidays.push({
      date,
      isOff,
      ...(windows ? { windows } : {})
    });
  }

  return holidays;
}

function parseAvailabilityConfig(availability: unknown): ParsedAvailability | null {
  if (!isRecord(availability)) {
    return null;
  }

  const timezone = normalizeTimeZone(availability.timezone);
  const weeklyRaw = isRecord(availability.weekly) ? availability.weekly : availability;
  const weekly = normalizeWeeklyAvailability(weeklyRaw);
  if (!weekly) {
    return null;
  }

  const holidays = normalizeHolidayOverrides(availability.holidays);
  if (!holidays) {
    return null;
  }

  return { timezone, weekly, holidays };
}

function isMinuteInsideWindows(currentMinute: number, windows: DailyWindow[]): boolean {
  for (const window of windows) {
    const start = parseTimeToMinutes(window.start);
    const end = parseTimeToMinutes(window.end);
    if (start === null || end === null) {
      return false;
    }

    if (currentMinute >= start && currentMinute <= end) {
      return true;
    }
  }

  return false;
}

export function isDoctorAvailableNow(availability: unknown, now = new Date()): boolean {
  if (!availability || typeof availability !== "object") {
    return true;
  }

  const parsed = parseAvailabilityConfig(availability);
  if (!parsed) {
    return false;
  }

  const day = normalizeWeekday(now, parsed.timezone);
  if (!day) {
    return false;
  }

  const currentDate = localDateInTimeZone(now, parsed.timezone);
  const currentMinute = hourMinuteInTimeZone(now, parsed.timezone);
  const holiday = parsed.holidays.find((item) => item.date === currentDate);
  if (holiday) {
    if (holiday.isOff) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(holiday, "windows")) {
      const holidayWindows = normalizeDailyWindows(holiday.windows);
      if (!holidayWindows || !holidayWindows.length) {
        return false;
      }
      return isMinuteInsideWindows(currentMinute, holidayWindows);
    }
  }

  const dayWindows = normalizeDailyWindows(parsed.weekly[day]);
  if (!dayWindows || !dayWindows.length) {
    return false;
  }

  return isMinuteInsideWindows(currentMinute, dayWindows);
}

export function validateDoctorAvailability(availability: unknown): boolean {
  if (!availability || typeof availability !== "object") {
    return false;
  }

  return parseAvailabilityConfig(availability) !== null;
}

export function defaultDoctorAvailability(): AvailabilityConfig {
  const weekdays: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const weekly: WeeklyAvailability = {};
  for (const day of weekdays) {
    weekly[day] = [{ start: "09:00", end: "17:00" }];
  }

  return {
    timezone: "America/New_York",
    weekly,
    holidays: []
  };
}
