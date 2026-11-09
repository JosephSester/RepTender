import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';
import RemindToast from '../features/reminders/RemindToast';

export default function AppShell() {
  return (
    <div className="shell">
      <main className="screen">
        <Outlet />
      </main>
      <TabBar />
      <RemindToast />
    </div>
  );
}
