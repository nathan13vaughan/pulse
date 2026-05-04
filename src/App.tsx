import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";

import DashboardView from "./views/Dashboard/DashboardView";
import BPView from "./views/BP/BPView";
import MealsView from "./views/Meals/MealsView";
import PlanView from "./views/Plan/PlanView";
import SettingsView from "./views/Settings/SettingsView";
import InsightsView from "./views/Insights/InsightsView";
import { startNotificationTicker, stopNotificationTicker } from "./services/notifications";

interface Tab {
  to: string;
  label: string;
  icon: string; // SVG path data
}

const TABS: Tab[] = [
  { to: "/",        label: "Today",    icon: "M12 3l9 8h-3v9h-4v-6H10v6H6v-9H3z" },
  { to: "/bp",      label: "Pressure", icon: "M12 21s-7-4.5-7-11a7 7 0 1114 0c0 6.5-7 11-7 11z" },
  { to: "/meals",   label: "Meals",    icon: "M7 2v9a3 3 0 003 3v8h2v-8a3 3 0 003-3V2h-1v7h-2V2h-1v7h-2V2H7zm10 0v20h2V14h2V8c0-3-2-6-4-6z" },
  { to: "/plan",    label: "Plan",     icon: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" },
  { to: "/settings", label: "Settings", icon: "M19.4 13c0-.3.1-.6.1-1s0-.7-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1l-.4-2.6h-4l-.3 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.5L4.6 11l-.1 1 .1 1-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1l.3 2.5h4l.4-2.6a7 7 0 001.7-1l2.4 1 2-3.5L19.4 13zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" },
];

export default function App() {
  useEffect(() => {
    startNotificationTicker();
    return () => stopNotificationTicker();
  }, []);

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/"          element={<DashboardView />} />
          <Route path="/bp/*"      element={<BPView />} />
          <Route path="/meals/*"   element={<MealsView />} />
          <Route path="/plan/*"    element={<PlanView />} />
          <Route path="/insights"  element={<InsightsView />} />
          <Route path="/settings"  element={<SettingsView />} />
        </Routes>
      </main>
      <nav className="tab-bar" aria-label="Primary">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) => `tab ${isActive ? "tab--active" : ""}`}
          >
            <svg className="tab__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={tab.icon} />
            </svg>
            <span className="tab__label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
