import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <button
      type="button"
      className="btn-primary"
      style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom) + 76px)', width: 'auto', zIndex: 40 }}
      onClick={() => updateServiceWorker(true)}
    >
      Update available — tap to refresh
    </button>
  );
}
