/**
 * Apple Push Notification service (APNs) over HTTP/2 with a token (.p8) key.
 *
 * Environment variables on the API server:
 *   APNS_KEY_ID     — the 10-character key id from the Apple Developer portal
 *   APNS_TEAM_ID    — your Apple team id
 *   APNS_KEY        — the .p8 file contents (PEM), newlines may be "\n"-escaped
 *   APNS_BUNDLE_ID  — the app's bundle id (default com.connect365.app)
 *   APNS_SANDBOX    — "1" to use the sandbox gateway (Xcode dev builds).
 *                     TestFlight and App Store builds use production.
 *
 * When the key is missing every send is a silent no-op, exactly like web push.
 */
import http2 from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';

const KEY_ID    = process.env['APNS_KEY_ID'] ?? '';
const TEAM_ID   = process.env['APNS_TEAM_ID'] ?? '';
const KEY_PEM   = (process.env['APNS_KEY'] ?? '').replace(/\\n/g, '\n');
const BUNDLE_ID = process.env['APNS_BUNDLE_ID'] || 'com.connect365.app';
const HOST      = process.env['APNS_SANDBOX'] === '1' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';

export function apnsConfigured(): boolean {
  return !!(KEY_ID && TEAM_ID && KEY_PEM);
}

let cachedToken: { value: string; issuedAt: number } | null = null;

/** APNs provider tokens are valid for an hour; refresh every 50 minutes. */
async function providerToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now - cachedToken.issuedAt < 50 * 60_000) return cachedToken.value;
  const key = await importPKCS8(KEY_PEM, 'ES256');
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
    .setIssuer(TEAM_ID)
    .setIssuedAt()
    .sign(key);
  cachedToken = { value, issuedAt: now };
  return value;
}

export type ApnsPayload = {
  title: string;
  body: string;
  /** In-app path to open when tapped. */
  url?: string;
  /** Collapses repeated notifications for the same thread. */
  tag?: string;
  badge?: number;
};

export type ApnsResult = { ok: true } | { ok: false; status: number; reason: string };

/** Send one alert push to one device token. */
export async function sendApns(deviceToken: string, payload: ApnsPayload): Promise<ApnsResult> {
  if (!apnsConfigured()) return { ok: false, status: 0, reason: 'not_configured' };
  const jwt = await providerToken();
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      ...(payload.tag ? { 'thread-id': payload.tag } : {}),
    },
    url: payload.url ?? '/notifications',
  });

  return new Promise<ApnsResult>((resolve) => {
    const client = http2.connect(HOST);
    const finish = (r: ApnsResult) => { try { client.close(); } catch { /* ignore */ } resolve(r); };
    client.on('error', (e) => finish({ ok: false, status: 0, reason: e.message }));

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
      'content-type': 'application/json',
    });
    let status = 0;
    let data = '';
    req.setEncoding('utf8');
    req.on('response', (headers) => { status = Number(headers[':status'] ?? 0); });
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      if (status === 200) finish({ ok: true });
      else {
        let reason = 'unknown';
        try { reason = (JSON.parse(data) as { reason?: string }).reason ?? reason; } catch { /* ignore */ }
        finish({ ok: false, status, reason });
      }
    });
    req.on('error', (e) => finish({ ok: false, status: 0, reason: e.message }));
    req.setTimeout(10_000, () => finish({ ok: false, status: 0, reason: 'timeout' }));
    req.end(body);
  });
}
