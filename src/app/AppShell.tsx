import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';

export default function AppShell() {
  return (
    <div className="shell">
      <main className="screen">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
