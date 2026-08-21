import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';
import './styles/scada-hmi-theme.css';
import './styles/scada-shell.css';
import './styles/scada-statusbar-refresh.css';
import './styles/pure-water-cabinet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
