import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import { useNavigate } from "react-router-dom";

function StatCard({ label, value, hint, right }) {
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{label}</div>
        {right}
      </div>

      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: ".2px" }}>{value}</div>
        {hint ? <div className="muted" style={{ fontSize: 12 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

function Sparkline({ data = [], height = 28 }) {
  const w = 120;
  const h = height;

  const safe = data.length ? data : [0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);

  const pts = safe.map((v, i) => {
    const x = (i / Math.max(1, safe.length - 1)) * (w - 2) + 1;
    const t = (v - min) / Math.max(1e-9, (max - min));
    const y = (1 - t) * (h - 2) + 1;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={pts.join(" ")}
        opacity="0.9"
      />
      <circle
        cx={pts[pts.length - 1].split(",")[0]}
        cy={pts[pts.length - 1].split(",")[1]}
        r="2.5"
        fill="currentColor"
      />
    </svg>
  );
}

function AlertCard({ a }) {
  const tone =
    a.type === "danger"
      ? { border: "1px solid rgba(176,0,32,.25)", bg: "rgba(176,0,32,.06)", color: "var(--danger)" }
      : a.type === "warn"
      ? { border: "1px solid rgba(0,47,170,.18)", bg: "rgba(0,47,170,.06)", color: "var(--brand)" }
      : { border: "1px solid rgba(0,0,0,.10)", bg: "rgba(204,233,236,.25)", color: "var(--ink)" };

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: tone.border,
        background: tone.bg,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 800, color: tone.color }}>{a.title}</div>
        {a.count != null ? <span className="badge blue">{a.count}</span> : null}
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{a.message}</div>
    </div>
  );
}

export default function DashboardPage() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await apiGet("/api/dashboard");
      setData(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const trend = data?.trend;
  const monthly = data?.monthly;

  const monthLabel = useMemo(() => {
    if (!monthly?.month) return "";
    const [y, m] = monthly.month.split("-");
    return `${y}-${m}`;
  }, [monthly?.month]);

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Dashboard</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Today: <b>{data?.date ?? "—"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="primary" onClick={() => nav("/reports")}>
            Reports
          </button>
        </div>
      </div>

      <div className="hr" />

      {err && (
        <div className="card" style={{ borderColor: "rgba(176,0,32,.25)" }}>
          <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{err}</div>
        </div>
      )}

      {!data ? (
        <div className="card">Loading dashboard…</div>
      ) : (
        <>
          {/* KPI + Sparklines */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 14,
            }}
          >
            <StatCard
              label="In-Patient (Today)"
              value={data.totals.inpatient}
              hint="Last 7 days"
              right={<span style={{ color: "var(--brand)" }}><Sparkline data={trend?.inpatient ?? []} /></span>}
            />

            <StatCard
              label="BP Logs (Today)"
              value={data.totals.bp}
              hint={`High BP: ${data.totals.high_bp}`}
              right={<span style={{ color: "var(--brand)" }}><Sparkline data={trend?.bp ?? []} /></span>}
            />

            <StatCard
              label="Checkups (Today)"
              value={data.totals.checkups}
              hint={`Open: ${data.totals.open_checkups}`}
              right={<span style={{ color: "var(--brand)" }}><Sparkline data={trend?.checkups ?? []} /></span>}
            />

            <StatCard
              label="Active Employees"
              value={data.totals.employees}
              hint="Master list"
              right={<span className="badge blue">Active</span>}
            />
          </div>

          <div className="hr" />

          {/* Alerts */}
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Alerts</h3>
                <div className="muted" style={{ fontSize: 13 }}>Auto-checks for today.</div>
              </div>
              <span className="badge blue">{(data.alerts ?? []).length} active</span>
            </div>

            {(data.alerts ?? []).length === 0 ? (
              <div className="muted">No alerts today ✅</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {data.alerts.map((a, i) => (
                  <AlertCard key={i} a={a} />
                ))}
              </div>
            )}
          </div>

          <div className="hr" />

          {/* Monthly summary */}
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Monthly Summary</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  Current month: <b>{monthLabel}</b>
                </div>
              </div>

              <button className="ghost" onClick={() => nav("/reports")}>
                View Reports →
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>In-Patient (Month)</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{monthly?.totals?.inpatient ?? 0}</div>
              </div>

              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>BP Logs (Month)</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{monthly?.totals?.bp ?? 0}</div>
              </div>

              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>Checkups (Month)</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{monthly?.totals?.checkups ?? 0}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Done: <b>{monthly?.totals?.checkups_done ?? 0}</b> • Open: <b>{monthly?.totals?.checkups_open ?? 0}</b> • Follow-up: <b>{monthly?.totals?.checkups_followup ?? 0}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="hr" />

          {/* Quick actions */}
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <h3>Quick Actions</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="primary" onClick={() => nav("/")}>In-Patient</button>
              <button className="ghost" onClick={() => nav("/bp")}>BP</button>
              <button className="ghost" onClick={() => nav("/checkups")}>Checkups</button>
              <button className="ghost" onClick={() => nav("/employees")}>Employees</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}