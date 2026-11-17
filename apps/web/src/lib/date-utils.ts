/**
 * PixelCraft POS — Sri Lanka (Asia/Colombo, UTC+05:30) Date & Time Utilities
 * Guaranteed accurate localized formatting for Live Terminal Clocks and Legal Tax Receipts.
 */

export function parseValidDate(input?: string | number | Date | null): Date {
  if (!input) return new Date();
  const d = new Date(input);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Format live real-time header clock: "Tue, Nov 17, 2026 • 10:05:30 AM"
 */
export function formatSriLankaHeaderClock(dateInput?: string | number | Date | null): string {
  const d = parseValidDate(dateInput);
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);

  return `${datePart} • ${timePart}`;
}

/**
 * Format receipt bill date: "YYYY-MM-DD" (e.g., 2026-11-17)
 */
export function formatSriLankaReceiptDate(dateInput?: string | number | Date | null): string {
  const d = parseValidDate(dateInput);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Format receipt bill time: "hh:mm:ss AM/PM" (e.g., 10:05:30 AM)
 */
export function formatSriLankaReceiptTime(dateInput?: string | number | Date | null): string {
  const d = parseValidDate(dateInput);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Format combined receipt date & time: "Date: 2026-11-17   Time: 10:05:30 AM"
 */
export function formatSriLankaReceiptDateTime(dateInput?: string | number | Date | null): {
  dateStr: string;
  timeStr: string;
  combinedLine: string;
} {
  const dateStr = formatSriLankaReceiptDate(dateInput);
  const timeStr = formatSriLankaReceiptTime(dateInput);
  return {
    dateStr,
    timeStr,
    combinedLine: `Date: ${dateStr}   Time: ${timeStr}`,
  };
}
