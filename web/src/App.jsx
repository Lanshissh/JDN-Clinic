import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return false;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, () => setDark((v) => !v)];
}

import InpatientPage from "./pages/InpatientPage";
import BpPage from "./pages/BpPage";
import CheckupsPage from "./pages/CheckupsPage";
import ReportsPage from "./pages/ReportsPage";
import EmployeesPage from "./pages/EmployeesPage";
import EmployeeHistoryPage from "./pages/EmployeeHistoryPage";
import DashboardPage from "./pages/DashboardPage";
import InventoryPage from "./pages/InventoryPage";
import SearchPage from "./pages/SearchPage";
import HelpButton from "./components/HelpButton";

import { nurseLogin, clearNurseToken, getNurseToken, formatApiError } from "./api";

const LOGO_SRC = "/jdn.jpg";

const NAV = [
  { to: "/", label: "Dashboard", short: "Home", icon: "dashboard" },
  { to: "/inpatient", label: "In-Patient", short: "Visits", icon: "hospital" },
  { to: "/bp", label: "BP Monitoring", short: "BP", icon: "activity" },
  { to: "/checkups", label: "Checkups", short: "Check", icon: "clipboard" },
  { to: "/employees", label: "Employees", short: "Staff", icon: "users" },
  { to: "/inventory", label: "Inventory", short: "Stock", icon: "report" },
  { to: "/reports", label: "Analytics & Reports", short: "Analytics & Reports", icon: "report" },
  { to: "/search", label: "Search", short: "Search", icon: "users" },
];

function Icon({ name, className = "" }) {
  const common = {
    className: `icon ${className}`.trim(),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const icons = {
    dashboard: (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="8" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="15" width="7" height="6" rx="1.5" />
      </svg>
    ),
    hospital: (
      <svg {...common}>
        <path d="M4 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" />
        <path d="M16 11h2a2 2 0 0 1 2 2v8" />
        <path d="M8 10h4" />
        <path d="M10 8v4" />
        <path d="M8 15h.01" />
        <path d="M12 15h.01" />
        <path d="M8 19h.01" />
        <path d="M12 19h.01" />
      </svg>
    ),
    activity: (
      <svg {...common}>
        <path d="M3 12h4l3-7 5 14 3-7h3" />
      </svg>
    ),
    clipboard: (
      <svg {...common}>
        <path d="M9 4h6" />
        <path d="M9 4a3 3 0 0 0-3 3v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7a3 3 0 0 0-3-3" />
        <path d="M9 4a3 3 0 0 0 6 0" />
        <path d="M9 13l2 2 4-5" />
      </svg>
    ),
    users: (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    report: (
      <svg {...common}>
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
        <path d="M9 9h1" />
      </svg>
    ),
    logout: (
      <svg {...common}>
        <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    ),
    menu: (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    ),
    close: (
      <svg {...common}>
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      </svg>
    ),
    eye: (
      <svg {...common}>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    eyeOff: (
      <svg {...common}>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2" />
        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2" />
        <path d="M6.1 6.8A17.3 17.3 0 0 0 2 12s3.5 7 10 7a10.5 10.5 0 0 0 4.1-.8" />
      </svg>
    ),
    sun: (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
    moon: (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  };

  return icons[name] ?? null;
}

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

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await nurseLogin(username, password, { remember });
      window.location.href = "/";
    } catch (error) {
      if (error?.status === 401) {
        setErr("Invalid username or password");
      } else if (error instanceof TypeError) {
        setErr("Cannot reach the clinic API. Check the API URL or CORS settings.");
      } else {
        setErr(formatApiError(error, "Unable to sign in right now. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="loginOverlay" aria-hidden="true" />

      <section className="loginPanel" aria-label="Clinic system sign in">
        <div className="loginBrandRow">
          <img src={LOGO_SRC} alt="JDN Clinic logo" className="loginLogo" />
          <div>
            <div className="loginEyebrow">JDN Clinic</div>
            <div className="loginBrandTitle">Clinic System</div>
          </div>
        </div>

        <div className="loginDivider" />

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <div>
            <div className="sectionEyebrow">Sign in</div>
            <h2 style={{ marginBottom: 4 }}>Welcome back</h2>
            <p style={{ marginBottom: 0, fontSize: 13 }}>
              Enter your credentials to access the system.
            </p>
          </div>

          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Enter your username"
              required
            />
          </label>

          <label>
            Password
            <div className="passwordField">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="iconButton"
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
              >
                <Icon name={showPw ? "eyeOff" : "eye"} />
              </button>
            </div>
          </label>

          <label className="checkRow">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>

          {err && <div className="formError">{err}</div>}

          <button className="primary loginSubmit" disabled={loading}>
            {loading ? "Logging in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function isActivePath(pathname, to) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function SidebarNav({ onNavigate, dark, onToggleTheme }) {
  function logout() {
    clearNurseToken();
    window.location.href = "/login";
  }

  return (
    <>
      <div className="sidebarBrand">
        <img src={LOGO_SRC} alt="JDN logo" className="sidebarLogo" />
        <div className="sidebarBrandCopy">
          <div className="sidebarTitle">JDN Clinic</div>
          <div className="sidebarSubtitle">Clinic System</div>
        </div>
      </div>

      <nav className="sidebarNav" aria-label="Primary navigation">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `sidebarLink ${isActive ? "isActive" : ""}`
            }
            title={item.label}
            onClick={onNavigate}
          >
            <span className="sidebarIcon">
              <Icon name={item.icon} />
            </span>
            <span className="sidebarText">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebarFooter">
        <div className="sidebarUser">
          <span className="statusDot" />
          <span className="sidebarText">Nurse session</span>
        </div>

        <button
          type="button"
          className="themeToggle"
          onClick={onToggleTheme}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span className="sidebarIcon">
            <Icon name={dark ? "sun" : "moon"} />
          </span>
          <span className="sidebarText">{dark ? "Light Mode" : "Dark Mode"}</span>
        </button>

        <button
          type="button"
          className="sidebarLink sidebarButton danger"
          onClick={logout}
          title="Logout"
        >
          <span className="sidebarIcon">
            <Icon name="logout" />
          </span>
          <span className="sidebarText">Logout</span>
        </button>
      </div>
    </>
  );
}

function AppShell() {
  const isMobile = useMediaQuery("(max-width: 860px)");
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, toggleTheme] = useTheme();

  const activeItem = useMemo(
    () => NAV.find((item) => isActivePath(pathname, item.to)) ?? NAV[0],
    [pathname]
  );

  useEffect(() => {
    document.body.classList.toggle("navDrawerOpen", menuOpen);
    return () => document.body.classList.remove("navDrawerOpen");
  }, [menuOpen]);

  return (
    <div className="appShell">
      {!isMobile && (
        <aside className="appSidebar" aria-label="Application navigation">
          <SidebarNav dark={dark} onToggleTheme={toggleTheme} />
        </aside>
      )}

      {isMobile && (
        <header className="mobileTopbar">
          <div className="mobileBrand">
            <img src={LOGO_SRC} alt="JDN logo" className="mobileLogo" />
            <div>
              <div className="mobileTitle">JDN Clinic</div>
              <div className="mobileSubtitle">{activeItem.short}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="iconButton"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
            >
              <Icon name={dark ? "sun" : "moon"} />
            </button>
            <button
              type="button"
              className="iconButton"
              aria-label="Open navigation"
              title="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </header>
      )}

      {isMobile && menuOpen && (
        <>
          <button
            type="button"
            className="drawerScrim"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="mobileDrawer" aria-label="Application navigation">
            <div className="drawerHeader">
              <div className="mobileBrand">
                <img src={LOGO_SRC} alt="JDN logo" className="mobileLogo" />
                <div>
                  <div className="mobileTitle">JDN Clinic</div>
                  <div className="mobileSubtitle">Clinic System</div>
                </div>
              </div>
              <button
                type="button"
                className="iconButton"
                aria-label="Close navigation"
                title="Close navigation"
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMenuOpen(false)} dark={dark} onToggleTheme={toggleTheme} />
          </aside>
        </>
      )}

      <main className="appMain">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inpatient" element={<InpatientPage />} />
          <Route path="/bp" element={<BpPage />} />
          <Route path="/checkups" element={<CheckupsPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeeHistoryPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </main>
      <HelpButton />
    </div>
  );
}

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
