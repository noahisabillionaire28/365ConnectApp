/**
 * "Download my data": fetches GET /users/me/export (a JSON bundle of
 * everything the server holds for the signed-in user) and hands it to the
 * browser as a file. On the web that is a plain download; inside the native
 * app the share sheet is used when available so the file can be saved.
 */
import { apiClient } from '@/lib/api';
import { isNative } from '@/lib/native';

export const DATA_EXPORT_PATH = '/users/me/export';

export async function downloadMyData(userId: string | null | undefined): Promise<void> {
  const bundle = await apiClient(userId).get<Record<string, unknown>>(DATA_EXPORT_PATH);
  const json = JSON.stringify(bundle, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `365connect-my-data-${date}.json`;
  const blob = new Blob([json], { type: 'application/json' });

  if (isNative() && typeof navigator.share === 'function' && typeof File !== 'undefined') {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      await navigator.share({ files: [file], title: 'My 365 Connect data' });
      return;
    } catch {
      /* fall through to the download path */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
