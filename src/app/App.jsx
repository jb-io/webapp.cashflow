import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { useStore } from './state/StateProvider.jsx';
import { money } from './format.js';
import { IconChart, IconList, IconTags, IconWallet } from './components/Icons.jsx';
import WelcomeDialog from './components/WelcomeDialog.jsx';

import ForecastPage from './pages/ForecastPage.jsx';
import EntriesPage from './pages/EntriesPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import AccountPage from './pages/AccountPage.jsx';

/** Hash-Routen: #/verlauf, #/buchungen, #/kategorien, #/konto */
const NAV = [
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
