import { NavLink } from 'react-router-dom';

export const TABS: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: 'Pets', icon: '🦎', end: true },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
