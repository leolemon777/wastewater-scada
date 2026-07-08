import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { useScadaStore } from './store/useScadaStore';
import './index.css';
import './scada-hmi-theme.css';
import './ui/scada-shell.css';
import './ui/scada-statusbar-refresh.css';

// Expose the store for perf diagnostics (draw-call measurement scripts).
if (typeof window !== 'undefined') {
  (window as unknown as { __scadaStore?: typeof useScadaStore }).__scadaStore = useScadaStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
