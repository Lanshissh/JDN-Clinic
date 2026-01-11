import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import InpatientPage from "./pages/InpatientPage";
import BpPage from "./pages/BpPage";
import CheckupsPage from "./pages/CheckupsPage";
import ReportsPage from "./pages/ReportsPage";
import EmployeesPage from "./pages/EmployeesPage";
import EmployeeHistoryPage from "./pages/EmployeeHistoryPage";
import DashboardPage from "./pages/DashboardPage";

import { nurseLogin, clearNurseToken, getNurseToken } from "./api";

const LOGO_SRC = "/jdn.jpg";

const NAV = [
  { to: "/", label: "Dashboard", short: "Home", icon: "📊" },
  { to: "/inpatient", label: "In-Patient", short: "Visits", icon: "🏥" },
  { to: "/bp", label: "BP", short: "BP", icon: "🩺" },
  { to: "/checkups", label: "Checkups", short: "Check", icon: "📝" },
  { to: "/employees", label: "Employees", short: "Staff", icon: "👥" },
  { to: "/reports", label: "Reports", short: "Reports", icon: "📄" },
];

/* ================= AUTH ================= */
function isLoggedIn() {
  return !!getNurseToken();
}

function RequireAuth({ children }) {
  const location = useLocation();
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/* ================= LOGIN ================= */
function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await nurseLogin(username, password, { remember });
      window.location.href = "/";
    } catch {
      setErr("Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 14 }}>
      <form onSubmit={submit} className="card" style={{ width: "min(380px,100%)", display: "grid", gap: 12 }}>
        <div style={{ textAlign: "center" }}>
          <img src={LOGO_SRC} alt="Logo" style={{ width: 64, height: 64, borderRadius: 16 }} />
          <h2>Nurse Login</h2>
        </div>

        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>

        <label>
          Password
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button type="button" className="ghost" onClick={() => setShowPw(v => !v)}>
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label style={{ display: "flex", gap: 8 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me
        </label>

        {err && <div style={{ color: "var(--danger)" }}>{err}</div>}

        <button className="primary" disabled={loading}>
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}

/* ================= LAYOUT ================= */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function isActivePath(pathname, to) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

/* ================= APP SHELL ================= */
function AppShell() {
  const isSmall = useMediaQuery("(max-width: 900px)");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { pathname } = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const activeItem = useMemo(
    () => NAV.find(n => isActivePath(pathname, n.to)) ?? NAV[0],
    [pathname]
  );

  function logout() {
    clearNurseToken();
    window.location.href = "/login";
  }

  return (
    <>
      <header className="appTopbar">
        <div className="container appTopbarInner">
          <div className="appBrand">
            <img src={LOGO_SRC} className="appLogoImage" />
            <div className="appBrandText">
              <div className="appTitle">Nursing System</div>
            </div>
          </div>

          {!isSmall ? (
            <>
              {/* ✅ CLEAN NAV — NO SCROLL */}
              <nav className="appNav">
                {NAV.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => `appNavLink ${isActive ? "isActive" : ""}`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <button className="ghost" onClick={logout}>Logout</button>
            </>
          ) : (
            <button className="ghost" onClick={() => setMenuOpen(v => !v)}>
              ☰ Menu
            </button>
          )}
        </div>

        {isSmall && menuOpen && (
          <div className="appMenuPanel">
            <div className="container appMenuGrid">
              {NAV.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="appNavLink"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.icon} {item.label}
                </NavLink>
              ))}
              <button className="danger" onClick={logout}>Logout</button>
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
    </>
  );
}

/* ================= ROUTER ================= */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}