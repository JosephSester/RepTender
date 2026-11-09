import './theme/tokens.css';
import './theme/base.css';
import './ui/ui.css';
import './ui/husbandry.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import UpdatePrompt from './app/UpdatePrompt';

// Spec §9: ask the browser not to evict our IndexedDB data.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdatePrompt />
  </StrictMode>,
);
