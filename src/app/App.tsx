import type { ComponentType, SVGProps } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { useStore } from './state/StateProvider.tsx';
import { money } from './format.ts';
import { IconChart, IconList, IconTags, IconWallet } from './components/Icons.tsx';
import WelcomeDialog from './components/WelcomeDialog.tsx';

import ForecastPage from './pages/ForecastPage.tsx';
import EntriesPage from './pages/EntriesPage.tsx';
import CategoriesPage from './pages/CategoriesPage.tsx';
import AccountPage from './pages/AccountPage.tsx';

/** Hash-Routen: #/verlauf, #/buchungen, #/kategorien, #/konto */
interface NavItem { to: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; }

const NAV: NavItem[] = [
  { to: '/verlauf', label: 'Verlauf', Icon: IconChart },
  { to: '/buchungen', label: 'Buchungen', Icon: IconList },
  { to: '/kategorien', label: 'Kategorien', Icon: IconTags },
  { to: '/konto', label: 'Konto', Icon: IconWallet },
];

export default function App() {
  const { doc, askStart } = useStore();

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">cashflow</div>
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon /> {label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div className="tiny muted truncate">{doc.account.name}</div>
          <div className="small num">Start {money(doc.account.startBalance)}</div>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <span className="brand">cashflow</span>
          <span className="spacer" />
          <span className="small muted num truncate">{doc.account.name}</span>
        </header>

        <Routes>
          <Route path="/verlauf" element={<ForecastPage />} />
          <Route path="/buchungen" element={<EntriesPage />} />
          <Route path="/kategorien" element={<CategoriesPage />} />
          <Route path="/konto" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/verlauf" replace />} />
        </Routes>
      </div>

      <nav className="tabbar">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon /> {label}
          </NavLink>
        ))}
      </nav>

      {askStart && <WelcomeDialog />}
    </div>
  );
}
