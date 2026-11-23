/**
 * PixelCraft POS — Sri Lanka (Asia/Colombo, UTC+05:30) Date & Time Utilities
 * Guaranteed accurate localized formatting for Live Terminal Clocks and Legal Tax Receipts.
 */

/**
 * Normalizes any timestamp input (ISO string, PostgreSQL timestamptz, space-separated date, Date, number, null)
 * to ensure UTC database timestamps without an explicit timezone offset are parsed as UTC
 * rather than being misparsed as local browser time (which causes a 5.5-hour error).
 * If input is missing or null, captures the exact current timestamp (new Date()).
 */
export function normalizeReceiptDate(input?: string | number | Date | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date() : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  let str = String(input).trim();
  if (!str) return new Date();

  // If space-separated ("2026-11-23 10:35:00"), convert to ISO "2026-11-23T10:35:00"
  if (str.includes(' ') && !str.includes('T')) {
    str = str.replace(' ', 'T');
  }

  // If string has no timezone offset (missing Z or +HH:MM / -HH:MM), append Z so it parses as UTC
  const hasTimezone = /[Zz]$|[+-]\d{2}(:?\d{2})?$/.test(str);
  if (!hasTimezone) {
    str = `${str}Z`;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function parseValidDate(input?: string | number | Date | null): Date {
  return normalizeReceiptDate(input);
}

/**
 * Format receipt bill date & time strictly in Asia/Colombo timezone:
 * Returns clean "DD/MM/YYYY hh:mm:ss AM/PM" (e.g., "23/11/2026 04:07:03 PM")
 */
export function formatReceiptColomboDateTime(input?: string | number | Date | null): string {
  const d = normalizeReceiptDate(input);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);

  return formatted.replace(',', '').replace(/\s+(am|pm)/i, (m) => m.toUpperCase());
}

/**
 * Returns split components for receipt date and time in Asia/Colombo:
 * dateStr: "DD/MM/YYYY" (e.g., "23/11/2026")
 * timeStr: "hh:mm:ss AM/PM" (e.g., "04:07:03 PM")
 * combined: "23/11/2026 04:07:03 PM"
 */
export function getReceiptColomboDateAndTime(input?: string | number | Date | null): {
  dateStr: string;
  timeStr: string;
  combined: string;
} {
  const d = normalizeReceiptDate(input);
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
    .format(d)
    .toUpperCase();

  const combined = `${dateStr} ${timeStr}`;

  return { dateStr, timeStr, combined };
}

/**
 * Format live real-time header clock: "Nov 19, 2026 • 10:25 AM"
 */
export function formatSriLankaHeaderClock(dateInput?: string | number | Date | null): string {
  const d = normalizeReceiptDate(dateInput);
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);

  return `${datePart} • ${timePart}`;
}

/**
 * Format receipt bill date: "DD/MM/YYYY" (e.g., 23/11/2026)
 */
export function formatSriLankaReceiptDate(dateInput?: string | number | Date | null): string {
  const { dateStr } = getReceiptColomboDateAndTime(dateInput);
  return dateStr;
}

/**
 * Format receipt bill time: "hh:mm:ss AM/PM" (e.g., 04:07:03 PM)
 */
export function formatSriLankaReceiptTime(dateInput?: string | number | Date | null): string {
  const { timeStr } = getReceiptColomboDateAndTime(dateInput);
  return timeStr;
}

/**
 * Format combined receipt date & time: "Date: 23/11/2026   Time: 04:07:03 PM"
 */
export function formatSriLankaReceiptDateTime(dateInput?: string | number | Date | null): {
  dateStr: string;
  timeStr: string;
  combinedLine: string;
} {
  const { dateStr, timeStr } = getReceiptColomboDateAndTime(dateInput);
  return {
    dateStr,
    timeStr,
    combinedLine: `Date: ${dateStr}   Time: ${timeStr}`,
  };
}
