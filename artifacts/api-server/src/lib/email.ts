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
};

/** Send one email. Returns true if it was accepted by Resend, false otherwise. */
export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<boolean> {
  const key = apiKey();
  if (!key) {
    logger.info({ to, subject }, '[email] RESEND_API_KEY not set — skipping send');
    return false;
  }
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    logger.warn({ to }, '[email] invalid recipient — skipping');
    return false;
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

/**
 * Branded wrapper for a simple notification email: a heading, a body line, and
 * an optional call-to-action button. Kept inline-styled for email-client support.
 */
export function renderNotificationEmail(opts: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  preheader?: string;
}): { html: string; text: string } {
  const { title, body, ctaLabel, ctaHref, preheader } = opts;
  const cta = ctaLabel && ctaHref
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${ctaHref}" style="display:inline-block;background:#0A1628;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">${ctaLabel}</a>
       </td></tr>`
    : '';
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preheader ?? body}</span>
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
          <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.5;">
            You're receiving this because you have email notifications on for 365 Connect.
            You can turn them off in the app under Settings &rarr; Notifications.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `${title}\n\n${body}${ctaHref ? `\n\n${ctaLabel}: ${ctaHref}` : ''}\n\n— 365 Connect\nTurn off emails in Settings → Notifications.`;
  return { html, text };
}
