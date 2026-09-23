/**
 * "Add to calendar" for a booked shift. Builds an .ics file on the device
 * (Apple Calendar, Outlook and everything else that reads iCalendar) and a
 * Google Calendar template link. No server round trip: everything a calendar
 * needs is already on the shift.
 */
import { isNative } from './native';

export const APP_ORIGIN = 'https://365-connect-app.vercel.app';

export type CalendarEvent = {
  shiftId: string;
  /** "Bartender" — the role; becomes "<job type> · <company>". */
  jobType: string;
  companyName: string;
  startTimeISO: string;
  endTimeISO: string;
  /** Venue zone; the call time in the description is written in it. */
  timezone?: string | null;
  location?: string | null;
  payRate?: number | null;
  payPeriod?: string | null;
  pointOfContact?: string | null;
  contactPhone?: string | null;
};

/** 2026-09-27T00:00:00.000Z → 20260927T000000Z (the iCalendar UTC form). */
export function icsStamp(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Backslash-escape the characters iCalendar treats specially. */
function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold a content line at 75 octets, as RFC 5545 requires. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) { out.push(rest.slice(0, 75)); rest = ` ${rest.slice(75)}`; }
  out.push(rest);
  return out.join('\r\n');
}

function callTime(ev: CalendarEvent): string {
  try {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: ev.timezone || undefined, timeZoneName: 'short',
    };
    return new Date(ev.startTimeISO).toLocaleString('en-US', opts);
  } catch { return ''; }
}

export function eventTitle(ev: CalendarEvent): string {
  return [ev.jobType, ev.companyName].filter(Boolean).join(' · ');
}

export function eventDescription(ev: CalendarEvent): string {
  const lines: string[] = [];
  const when = callTime(ev);
  if (when) lines.push(`Call time: ${when}`);
  if (ev.payRate && ev.payRate > 0) lines.push(`Pay: $${ev.payRate}/${ev.payPeriod || 'hr'}`);
  const contact = [ev.pointOfContact, ev.contactPhone].filter(Boolean).join(' · ');
  if (contact) lines.push(`Point of contact: ${contact}`);
  lines.push(`Shift details: ${APP_ORIGIN}/shift/${ev.shiftId}`);
  return lines.join('\n');
}

/** The full .ics document for one shift, with a reminder two hours before. */
export function buildIcs(ev: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//365 Connect//Shift//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:shift-${ev.shiftId}@365connect`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(ev.startTimeISO)}`,
    `DTEND:${icsStamp(ev.endTimeISO)}`,
    `SUMMARY:${icsText(eventTitle(ev))}`,
    ...(ev.location ? [`LOCATION:${icsText(ev.location)}`] : []),
    `DESCRIPTION:${icsText(eventDescription(ev))}`,
    `URL:${APP_ORIGIN}/shift/${ev.shiftId}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Shift starts in 2 hours',
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Google Calendar "create event" link pre-filled from the shift. */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(ev),
    dates: `${icsStamp(ev.startTimeISO)}/${icsStamp(ev.endTimeISO)}`,
    details: eventDescription(ev),
    ...(ev.location ? { location: ev.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function fileName(ev: CalendarEvent): string {
  const base = eventTitle(ev).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'shift';
  return `${base}.ics`;
}

/**
 * Hand the .ics to the device. On the web a Blob download (Safari and Chrome
 * both then offer to open it in the calendar). Inside the iOS app a Blob URL
 * has nowhere to go, so the same file is opened as a text/calendar data URL,
 * which the system offers to add to Calendar. (The app does not ship the
 * Capacitor Browser plugin; window.open is what the web view provides.)
 */
export async function openIcs(ev: CalendarEvent): Promise<void> {
  const ics = buildIcs(ev);
  if (isNative()) {
    window.open(`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`, '_blank');
    return;
  }
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(ev);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
