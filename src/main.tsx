import './theme/tokens.css';
import './theme/base.css';
import './ui/ui.css';
import './ui/husbandry.css';
import './ui/settings.css';
import './ui/toast.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import ErrorBoundary from './app/ErrorBoundary';
import UpdatePrompt from './app/UpdatePrompt';

// Spec §9: ask the browser not to evict our IndexedDB data. Refusal is fine; never an unhandled rejection.
void navigator.storage?.persist?.().catch(() => false);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {/* Outside the boundary: a waiting fix can still be installed from the crash screen. */}
    <UpdatePrompt />
  </StrictMode>,
);
