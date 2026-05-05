import { useEffect, useRef } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";

import DashboardView from "./views/Dashboard/DashboardView";
import BPView from "./views/BP/BPView";
import MealsView from "./views/Meals/MealsView";
import PlanView from "./views/Plan/PlanView";
import { GroceryListView } from "./views/Plan/GroceryListView";
import SettingsView from "./views/Settings/SettingsView";
import InsightsView from "./views/Insights/InsightsView";
import TipsView from "./views/Tips/TipsView";
import { startNotificationTicker, stopNotificationTicker } from "./services/notifications";
import { haptic } from "./services/haptics";

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
  { to: "/grocery", label: "Grocery",  icon: "M7 18a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM7.16 14h9.45c.75 0 1.41-.41 1.75-1.03L21.7 6H5.21L4.27 4H1v2h2l3.6 7.59-1.35 2.45A2 2 0 007 19h12v-2H7.42a.25.25 0 01-.22-.37L7.16 14z" },
  { to: "/settings", label: "Settings", icon: "M19.4 13c0-.3.1-.6.1-1s0-.7-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1l-.4-2.6h-4l-.3 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.5L4.6 11l-.1 1 .1 1-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1l.3 2.5h4l.4-2.6a7 7 0 001.7-1l2.4 1 2-3.5L19.4 13zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" },
];

/** Minimum horizontal travel (px) before a touch counts as a tab swipe. */
const SWIPE_DISTANCE_PX = 80;
/** Horizontal must dominate vertical by at least this ratio to count as a swipe. */
const SWIPE_AXIS_RATIO = 1.5;
/** Selectors where swipe should be ignored — text fields, modals, charts, horizontal scrollers. */
const NO_SWIPE_SELECTOR =
  'input, textarea, select, .modal-overlay, .filter-strip, .recharts-wrapper, [data-no-swipe="true"]';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const swipeStateRef = useRef({ x: 0, y: 0, active: false, target: null as Element | null });

  useEffect(() => {
    startNotificationTicker();
    return () => stopNotificationTicker();
  }, []);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        swipeStateRef.current.active = false;
        return;
      }
      const t = e.touches[0]!;
      const target = e.target instanceof Element ? e.target : null;
      // Bail early if the gesture started inside a no-swipe ancestor.
      if (target && target.closest(NO_SWIPE_SELECTOR)) {
        swipeStateRef.current.active = false;
        return;
      }
      swipeStateRef.current = { x: t.clientX, y: t.clientY, active: true, target };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const state = swipeStateRef.current;
      if (!state.active) return;
      swipeStateRef.current.active = false;

      if (e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0]!;
      const dx = t.clientX - state.x;
      const dy = t.clientY - state.y;

      if (Math.abs(dx) < SWIPE_DISTANCE_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;

      const idx = currentTabIndex(location.pathname);
      if (idx < 0) return;
      // Swipe-left (dx < 0) advances forward; swipe-right (dx > 0) goes back.
      const next = idx + (dx < 0 ? 1 : -1);
      if (next < 0 || next >= TABS.length) return;
      haptic.switch();
      navigate(TABS[next]!.to);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [location.pathname, navigate]);

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/"          element={<DashboardView />} />
          <Route path="/bp/*"      element={<BPView />} />
          <Route path="/meals/*"   element={<MealsView />} />
          <Route path="/plan"      element={<PlanView />} />
          <Route path="/grocery"   element={<GroceryListView />} />
          <Route path="/insights"  element={<InsightsView />} />
          <Route path="/tips"      element={<TipsView />} />
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

function currentTabIndex(pathname: string): number {
  return TABS.findIndex((t) => {
    if (t.to === "/") return pathname === "/";
    return pathname === t.to || pathname.startsWith(`${t.to}/`);
  });
}
