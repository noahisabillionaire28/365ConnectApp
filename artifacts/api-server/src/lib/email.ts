/**
 * Transactional email via Resend (https://resend.com).
 *
 * Configuration (environment variables on the API server):
 *   RESEND_API_KEY  — your Resend API key (required to actually send).
 *   EMAIL_FROM      — the From address, e.g. "365 Connect <noreply@yourdomain.com>".
 *                     Defaults to Resend's shared test sender, which only
 *                     delivers to your own Resend account email until you verify
 *                     a domain.
 *   APP_URL         — public app URL used for links in emails (optional).
 *
 * If RESEND_API_KEY is unset, sends are skipped (logged) so the app keeps
 * working without email configured. Failures never throw — email is best-effort.
 */
import { logger } from './logger.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function apiKey(): string | null {
  return process.env['RESEND_API_KEY'] || null;
}

function fromAddress(): string {
  return process.env['EMAIL_FROM'] || '365 Connect <onboarding@resend.dev>';
}

export function appUrl(): string {
  return (process.env['APP_URL'] || 'https://365-connect-app.vercel.app').replace(/\/$/, '');
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * One-click unsubscribe link for this recipient. When given, the message
   * carries RFC 8058 List-Unsubscribe / List-Unsubscribe-Post headers so mail
   * clients show their own "Unsubscribe" control.
   */
  unsubscribeUrl?: string | null;
  /** Any extra headers (Resend forwards them verbatim). */
  headers?: Record<string, string>;
};

/** Send one email. Returns true if it was accepted by Resend, false otherwise. */
export async function sendEmail({ to, subject, html, text, unsubscribeUrl, headers }: SendEmailInput): Promise<boolean> {
  const key = apiKey();
  if (!key) {
    logger.info({ to, subject }, '[email] RESEND_API_KEY not set — skipping send');
    return false;
  }
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    logger.warn({ to }, '[email] invalid recipient — skipping');
    return false;
  }
  const allHeaders: Record<string, string> = { ...(headers ?? {}) };
  if (unsubscribeUrl) {
    allHeaders['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    allHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [to],
        subject,
        html,
        text: text ?? undefined,
        ...(Object.keys(allHeaders).length ? { headers: allHeaders } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.warn({ status: res.status, detail }, '[email] Resend rejected the send');
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, '[email] send threw');
    return false;
  }
}

/** Escape text for an HTML body or attribute value. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) links may become the button; anything else drops the button. */
function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const u = new URL(href);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Branded wrapper for a simple notification email: a heading, a body line, and
 * an optional call-to-action button. Kept inline-styled for email-client support.
 * Every piece of copy is escaped: titles and bodies carry user-written text
 * (shift titles, dispute notes, handles).
 */
export function renderNotificationEmail(opts: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  preheader?: string;
  /** One-click unsubscribe link for this recipient (omitted → generic footer only). */
  unsubscribeUrl?: string | null;
}): { html: string; text: string } {
  const { ctaLabel, preheader } = opts;
  const title = escapeHtml(opts.title);
  const body = escapeHtml(opts.body);
  const href = safeHref(opts.ctaHref);
  const manageUrl = `${appUrl()}/notification-settings`;
  const unsubUrl = safeHref(opts.unsubscribeUrl ?? undefined);
  const footerLinks = [
    `<a href="${escapeHtml(manageUrl)}" style="color:#4B5563;text-decoration:underline;">Manage notifications</a>`,
    unsubUrl ? `<a href="${escapeHtml(unsubUrl)}" style="color:#4B5563;text-decoration:underline;">Unsubscribe from email</a>` : '',
  ].filter(Boolean).join(' &nbsp;&middot;&nbsp; ');
  const cta = ctaLabel && href
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${escapeHtml(href)}" style="display:inline-block;background:#0A1628;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">${escapeHtml(ctaLabel)}</a>
       </td></tr>`
    : '';
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preheader != null ? escapeHtml(preheader) : body}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0A1628;padding:18px 24px;">
          <span style="color:#ffffff;font-weight:800;font-size:16px;letter-spacing:-0.2px;">365 Connect</span>
        </td></tr>
        <tr><td style="padding:26px 24px 22px;">
          <h1 style="margin:0 0 10px;color:#111827;font-size:19px;font-weight:800;">${title}</h1>
          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">${body}</p>
          <table role="presentation" cellpadding="0" cellspacing="0">${cta}</table>
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #F0F0F0;">
          <p style="margin:0 0 8px;color:#4B5563;font-size:12px;line-height:1.5;">
            You're receiving this because you have email notifications on for 365 Connect.
            Service and security messages may still be sent after you unsubscribe.
          </p>
          <p style="margin:0;color:#4B5563;font-size:12px;line-height:1.5;">${footerLinks}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `${opts.title}\n\n${opts.body}${href ? `\n\n${ctaLabel}: ${href}` : ''}\n\n— 365 Connect\nManage notifications: ${manageUrl}${unsubUrl ? `\nUnsubscribe from email: ${unsubUrl}` : ''}`;
  return { html, text };
}

/** Tiny standalone HTML page for the unsubscribe landing (no app shell needed). */
export function renderUnsubscribePage(opts: { ok: boolean; message: string }): string {
  const heading = opts.ok ? 'You are unsubscribed' : 'This link did not work';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(heading)} · 365 Connect</title></head>
<body style="margin:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <main style="max-width:460px;margin:48px auto;background:#fff;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;">
    <div style="background:#0A1628;padding:18px 24px;"><span style="color:#fff;font-weight:800;font-size:16px;">365 Connect</span></div>
    <div style="padding:26px 24px 24px;">
      <h1 style="margin:0 0 10px;color:#111827;font-size:19px;font-weight:800;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">${escapeHtml(opts.message)}</p>
      <a href="${escapeHtml(appUrl())}/notification-settings" style="display:inline-block;background:#0A1628;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">Notification settings</a>
    </div>
  </main>
</body></html>`;
}
