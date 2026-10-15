import { useEffect } from 'react';

/**
 * Colour the phone's status bar to match a screen while it is mounted.
 *
 * Installed to the iOS home screen, the status bar takes the page's own
 * background colour (apple-mobile-web-app-status-bar-style "default"), and
 * Android Chrome reads the theme-color meta. Both are white for the app as
 * a whole; a screen with a dark header sets its colour here so the header
 * runs to the top edge of the screen, and the previous values come back
 * when the screen goes away.
 */
export function useStatusBarColor(color: string) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prev = { html: html.style.backgroundColor, body: body.style.backgroundColor, meta: meta?.getAttribute('content') ?? null };
    html.style.backgroundColor = color;
    body.style.backgroundColor = color;
    meta?.setAttribute('content', color);
    return () => {
      html.style.backgroundColor = prev.html;
      body.style.backgroundColor = prev.body;
      if (meta && prev.meta != null) meta.setAttribute('content', prev.meta);
    };
  }, [color]);
}
