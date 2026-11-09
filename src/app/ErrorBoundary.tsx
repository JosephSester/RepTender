import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ExportBackupButton } from '../features/backup/ExportBackupButton';

interface Props {
  children: ReactNode;
  /** Tests only; defaults to reloadHome(). */
  onReload?: () => void;
}

interface State {
  error: Error | null;
}

/** Spec §11: an unexpected rendering error shows CrashScreen instead of a white screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('RepTender crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <CrashScreen error={this.state.error} onReload={this.props.onReload ?? reloadHome} />;
  }
}

/** Reload on the Pets screen: reloading the screen that crashed could just crash again. */
export function reloadHome(): void {
  window.location.hash = '#/';
  window.location.reload();
}

/** Uses only the database and file delivery, so the backup works even when every screen is broken. */
export function CrashScreen({ error, onReload }: { error: Error; onReload: () => void }) {
  return (
    <div className="shell">
      <main className="screen crash">
        <div className="crash-icon" aria-hidden="true">🦎</div>
        <h1>Something went wrong</h1>
        <p>RepTender hit an unexpected problem.</p>
        <p>Your pets and records are still saved on this iPhone.</p>
        <div className="data-actions">
          <button type="button" className="btn-primary" onClick={onReload}>Reload</button>
          <p className="muted setting-note">If it keeps happening, save a backup first:</p>
          <ExportBackupButton />
        </div>
        <details className="crash-details">
          <summary>Details</summary>
          <pre>{error.message}</pre>
        </details>
      </main>
    </div>
  );
}
