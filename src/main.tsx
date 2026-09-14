import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyTheme, readStoredTheme } from './lib/theme';

// Avant le premier rendu : le thème mémorisé est posé sur <html> sans attendre
// React, sinon la page s'affiche un instant dans l'autre thème.
applyTheme(readStoredTheme());

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Élément #root introuvable dans index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
