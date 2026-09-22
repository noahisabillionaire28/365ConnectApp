import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell configuration (iOS via Capacitor).
 *
 * The React app is built exactly as for the web (`vite build` → dist/public)
 * and bundled inside the native app. Nothing about the web deployment changes.
 *
 * appId is the iOS bundle identifier — it must match the App ID created in
 * the Apple Developer portal. Change it here before the first TestFlight
 * build if you register a different one.
 */
const config: CapacitorConfig = {
  appId: 'com.connect365.app',
  appName: '365 Connect',
  webDir: 'dist/public',
  ios: {
    contentInset: 'automatic',
    // The web app already handles safe areas via env(safe-area-inset-*).
    scrollEnabled: true,
    backgroundColor: '#FFFFFF',
  },
  server: {
    // Serve bundled assets from a secure origin so cookies/storage behave like the web.
    iosScheme: 'https',
    hostname: 'app.365connect.local',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0A1628',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
