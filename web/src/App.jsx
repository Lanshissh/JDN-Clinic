import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import InpatientPage from "./pages/InpatientPage";
import BpPage from "./pages/BpPage";
import CheckupsPage from "./pages/CheckupsPage";
import ReportsPage from "./pages/ReportsPage";
import EmployeesPage from "./pages/EmployeesPage";
import EmployeeHistoryPage from "./pages/EmployeeHistoryPage";
import DashboardPage from "./pages/DashboardPage";

const LOGO_SRC = "/jdn.jpg";

const NAV = [
  { to: "/", label: "Dashboard", short: "Home", icon: "📊" },
  { to: "/inpatient", label: "In-Patient", short: "Visits", icon: "🏥" },
  { to: "/bp", label: "BP", short: "BP", icon: "🩺" },
  { to: "/checkups", label: "Checkups", short: "Check", icon: "📝" },
  { to: "/employees", label: "Employees", short: "Staff", icon: "👥" },
  { to: "/reports", label: "Reports", short: "Reports", icon: "📄" },
];

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    onChange();
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

function isActivePath(pathname, to) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function AppShell() {
  // tablet+mobile
  const isSmall = useMediaQuery("(max-width: 900px)");
  // phone only (bottom tabs should be phone only)
  const isMobile = useMediaQuery("(max-width: 768px)");
  // tablet-ish (for nicer grid)
  const isTablet = useMediaQuery("(min-width: 600px) and (max-width: 900px)");

  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const headerRef = useRef(null);

  // close menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // close menu on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // close menu on outside click/tap (touch + mouse)
  useEffect(() => {
    if (!menuOpen) return;

    function onDocPointerDown(e) {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target)) setMenuOpen(false);
    }

    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [menuOpen]);

  // prevent background scroll while menu open
  useEffect(() => {
    if (!menuOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // reserve space for bottom tabs only on phone
  useEffect(() => {
    if (isMobile) document.body.classList.add("hasBottomTabs");
    else document.body.classList.remove("hasBottomTabs");

    return () => document.body.classList.remove("hasBottomTabs");
  }, [isMobile]);

  // if resizing from mobile->desktop, close the menu
  useEffect(() => {
    if (!isSmall) setMenuOpen(false);
  }, [isSmall]);

  const activeItem = useMemo(() => {
    return NAV.find((n) => isActivePath(pathname, n.to)) ?? NAV[0];
  }, [pathname]);

  // bottom tabs: only the “fast entry” pages (phone only)
  const bottomTabs = useMemo(() => [NAV[0], NAV[1], NAV[2], NAV[3]], []);

  return (
    <>
      <header className="appTopbar" ref={headerRef}>
        <div className="container appTopbarInner appTopbarInnerMobileFix">
          {/* Brand */}
          <div className="appBrand appBrandMobileFix">
            <img src={LOGO_SRC} alt="Clinic Logo" className="appLogoImage" />
            <div className="appBrandText appBrandTextMobileFix">
              <div className="appTitle">Nursing System</div>
              <div className="appSubtitle appSubtitleMobileFix">
                Fast clinic logging • Clean records • Easy reporting
              </div>
            </div>
          </div>

          {/* Right */}
          {!isSmall ? (
            <nav className="appNav" aria-label="Primary navigation">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `appNavLink ${isActive ? "isActive" : ""}`}
                  title={item.label}
                >
                  <span style={{ marginRight: 6 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : (
            <div className="appHeaderActions">
              <button
                type="button"
                className={menuOpen ? "primary" : "ghost"}
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-controls="mobileMenu"
                title="Menu"
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 900,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
                  {menuOpen ? "✕" : "☰"}
                </span>
                <span>Menu</span>
              </button>
            </div>
          )}
        </div>

        {/* Page label row (tablet+mobile) */}
        {isSmall && (
          <div className="container" style={{ paddingTop: 6, paddingBottom: 10 }}>
            <div className="appPagePill">
              <span style={{ marginRight: 8 }}>{activeItem.icon}</span>
              <span style={{ fontWeight: 900 }}>{activeItem.label}</span>
            </div>
          </div>
        )}

        {/* ✅ Backdrop overlay (makes it feel like a real menu modal) */}
        {isSmall && menuOpen && (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.25)",
              backdropFilter: "blur(2px)",
              zIndex: 55,
            }}
          />
        )}

        {/* Mobile/Tablet menu */}
        {isSmall && menuOpen && (
          <div
            id="mobileMenu"
            className="appMenuPanel"
            style={{
              position: "relative",
              zIndex: 56,
            }}
          >
            <div className="container" style={{ paddingTop: 12, paddingBottom: 14 }}>
              <div
                className="appMenuGrid"
                style={{
                  gridTemplateColumns: isTablet ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
                }}
              >
                {NAV.map((item) => {
                  const active = isActivePath(pathname, item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      className={`appNavLink ${active ? "isActive" : ""}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "12px 12px",
                        borderRadius: 14,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{item.icon}</span>
                        <span style={{ fontWeight: 900 }}>{item.label}</span>
                      </span>
                      <span style={{ opacity: active ? 1 : 0.55 }}>›</span>
                    </NavLink>
                  );
                })}
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Tip: On phone, use the bottom tabs for quick entry (Visits, BP, Checkups).
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="appMain">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inpatient" element={<InpatientPage />} />
          <Route path="/bp" element={<BpPage />} />
          <Route path="/checkups" element={<CheckupsPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeeHistoryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </main>

      {/* Bottom tabs (PHONE ONLY) */}
      {isMobile && (
        <div className="appBottomTabs">
          <div
            className="container appBottomTabsInner"
            style={{
              paddingTop: 10,
              paddingBottom: 10,
              display: "grid",
              gridTemplateColumns: `repeat(${bottomTabs.length}, minmax(0, 1fr))`,
              gap: 10,
            }}
          >
            {bottomTabs.map((t) => {
              const active = isActivePath(pathname, t.to);
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.to === "/"}
                  className={`appTab ${active ? "isActive" : ""}`}
                  style={{ textDecoration: "none" }}
                >
                  <div style={{ fontSize: 16, lineHeight: 1 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".2px" }}>
                    {t.short}
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}