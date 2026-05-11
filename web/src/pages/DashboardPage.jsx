import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";

function StatCard({ label, value, hint, right, onClick }) {
  return (
    <div
      className="card statCard"
      style={{ display: "grid", gap: 10, cursor: onClick ? "pointer" : undefined }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>{label}</div>
        {right}
      </div>

      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 34, fontWeight: 950 }}>{value}</div>
        {hint ? <div className="muted" style={{ fontSize: 12 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

function Sparkline({ data = [], height = 28 }) {
  const width = 120;
  const safe = data.length ? data : [0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);

  const pts = safe.map((v, i) => {
    const x = (i / Math.max(1, safe.length - 1)) * (width - 2) + 1;
    const t = (v - min) / Math.max(1e-9, max - min);
    const y = (1 - t) * (height - 2) + 1;
    return `${x},${y}`;
  });

  const [cx, cy] = pts[pts.length - 1].split(",");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={pts.join(" ")}
        opacity="0.9"
      />
      <circle cx={cx} cy={cy} r="2.5" fill="currentColor" />
    </svg>
  );
}

function AlertCard({ alert, onAction }) {
  const tone =
    alert.type === "danger"
      ? "danger"
      : alert.type === "birthday"
        ? "info"
        : "warning";

  return (
    <div className={`notice ${tone}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="noticeTitle">{alert.title}</div>
          <div className="noticeText">{alert.message}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {alert.count != null ? <span className="badge blue">{alert.count}</span> : null}
          {onAction ? (
            <button type="button" className="ghost" onClick={onAction} style={{ padding: "6px 10px", minHeight: 32 }}>
              {alert.action_label || "View"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function dashboardErrorCopy(error) {
  const details = error?.details || "";

  if (/ENOTFOUND/i.test(details)) {
    return {
      title: "Dashboard data is unavailable",
      message:
        "The API cannot resolve the Supabase project host. Check SUPABASE_URL in api/.env, then restart the API server.",
      details,
    };
  }

  if (/fetch failed/i.test(details)) {
    return {
      title: "Dashboard data is unavailable",
      message:
        "The API cannot reach Supabase right now. Check the connection, DNS/firewall settings, and SUPABASE_URL.",
      details,
    };
  }

  return {
    title: error?.title || "Dashboard data is unavailable",
    message: details || "The dashboard request failed. Try refreshing the page.",
    details,
  };
}

export default function DashboardPage() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const result = await apiGet("/api/dashboard");
      setData(result);
    } catch (e) {
      setData(null);
      setErr({
        title: e?.payload?.error || "Failed to load dashboard",
        details: e?.payload?.details || e?.message || String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const trend = data?.trend;
  const monthly = data?.monthly;
  const allTime = data?.all_time;

  const monthLabel = useMemo(() => {
    if (!monthly?.month) return "";
    const [year, month] = monthly.month.split("-");
    return `${year}-${month}`;
  }, [monthly?.month]);

  const dashboardError = err ? dashboardErrorCopy(err) : null;

  return (
    <div className="container">
      <div style={{ display: "flex", gap: 12, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Dashboard</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Today: <b>{data?.date ?? "-"}</b>
          </div>
        </div>

        <div data-tour="dash-quickactions" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="primary" onClick={() => nav("/reports")}>
            Reports
          </button>
        </div>
      </div>

      <div className="hr" />

      {dashboardError ? (
        <div className="notice danger">
          <div>
            <div className="noticeTitle">{dashboardError.title}</div>
            <div className="noticeText">{dashboardError.message}</div>
          </div>
          {dashboardError.details ? (
            <details className="technicalDetails">
              <summary>Technical details</summary>
              <pre>{dashboardError.details}</pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {loading && !data ? <div className="card">Loading dashboard...</div> : null}

      {!loading && !data && !err ? (
        <div className="card">No dashboard data loaded.</div>
      ) : null}

      {data ? (
        <>
          <div
            data-tour="dash-stats"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 14,
            }}
          >
            <StatCard
              label="In-Patient Today"
              value={data.totals.inpatient}
              hint="Last 7 days"
              right={<span style={{ color: "var(--brand)" }}><Sparkline data={trend?.inpatient ?? []} /></span>}
              onClick={() => nav("/inpatient")}
            />

            <StatCard
              label="BP Logs Today"
              value={data.totals.bp}
              hint={`High BP: ${data.totals.high_bp}`}
              right={<span style={{ color: "var(--brand)" }}><Sparkline data={trend?.bp ?? []} /></span>}
              onClick={() => nav("/bp")}
            />

            <StatCard
              label="Checkups Today"
              value={data.totals.checkups}
              hint={`Open: ${data.totals.open_checkups}`}
              right={<span style={{ color: "var(--brand)" }}><Sparkline data={trend?.checkups ?? []} /></span>}
              onClick={() => nav("/checkups")}
            />

            <StatCard
              label="Active Employees"
              value={data.totals.employees}
              hint={`Birthdays today: ${data.totals.birthdays_today ?? 0}`}
              right={<span className="badge blue">Active</span>}
              onClick={() => nav("/employees")}
            />
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>All-Time Summary</h3>
              <div className="muted" style={{ fontSize: 13 }}>
                Total records saved in the system.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 14,
              }}
            >
              <StatCard
                label="In-Patient All Time"
                value={allTime?.inpatient ?? 0}
                hint="Total records"
                right={<span className="badge blue">All</span>}
                onClick={() => nav("/inpatient")}
              />

              <StatCard
                label="BP Logs All Time"
                value={allTime?.bp ?? 0}
                hint="Total readings"
                right={<span className="badge blue">All</span>}
                onClick={() => nav("/bp")}
              />

              <StatCard
                label="Checkups All Time"
                value={allTime?.checkups ?? 0}
                hint="Total requests"
                right={<span className="badge blue">All</span>}
                onClick={() => nav("/checkups")}
              />

              <StatCard
                label="First Aiders All Time"
                value={allTime?.first_aiders ?? 0}
                hint="Total first aiders"
                right={<span className="badge blue">All</span>}
                onClick={() => nav("/first-aiders")}
              />
            </div>
          </div>

          <div className="hr" />

          <div data-tour="dash-alerts" className="card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Alerts</h3>
                <div className="muted" style={{ fontSize: 13 }}>Auto-checks for today.</div>
              </div>
              <span className="badge blue">{(data.alerts ?? []).length} active</span>
            </div>

            {(data.alerts ?? []).length === 0 ? (
              <div className="muted">No alerts today.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {data.alerts.map((alert, i) => (
                  <AlertCard
                    key={i}
                    alert={alert}
                    onAction={alert.action_path ? () => nav(alert.action_path) : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hr" />

          <div data-tour="dash-monthly" className="card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Monthly Summary</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  Current month: <b>{monthLabel}</b>
                </div>
              </div>

              <button className="ghost" onClick={() => nav("/reports")}>
                View Reports
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>In-Patient Month</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{monthly?.totals?.inpatient ?? 0}</div>
              </div>

              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>BP Logs Month</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{monthly?.totals?.bp ?? 0}</div>
              </div>

              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>Checkups Month</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{monthly?.totals?.checkups ?? 0}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Done: <b>{monthly?.totals?.checkups_done ?? 0}</b> | Open:{" "}
                  <b>{monthly?.totals?.checkups_open ?? 0}</b> | Follow-up:{" "}
                  <b>{monthly?.totals?.checkups_followup ?? 0}</b>
                </div>
              </div>
            </div>
          </div>

        </>
      ) : null}
    </div>
  );
}
