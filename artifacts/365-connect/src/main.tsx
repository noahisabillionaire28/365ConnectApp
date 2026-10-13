import { createRoot } from 'react-dom/client';

import App from './App';

import '@fontsource-variable/space-grotesk';
import './index.css';
import { registerServiceWorker } from './hooks/usePush';

createRoot(document.getElementById('root')!).render(<App />);

// Push notifications need a service worker; registration is best-effort.
if (import.meta.env.PROD) void registerServiceWorker();
