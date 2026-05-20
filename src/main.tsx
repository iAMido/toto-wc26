import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import 'flag-icons/css/flag-icons.min.css'; // SVG country flags (Windows-safe).
import './i18n/i18n'; // Initialize i18next before rendering.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
