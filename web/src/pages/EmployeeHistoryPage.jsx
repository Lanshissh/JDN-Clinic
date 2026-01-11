import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../api";
import DataTable from "../components/DataTable";

export default function EmployeeHistoryPage() {
  const nav = useNavigate();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [tab, setTab] = useState("all"); // all | inpatient | bp | checkups
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);

    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    try {
      const r = await apiGet(`/api/employees/${id}/history?${qs.toString()}`);
      setData(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const employee = data?.employee;

  const headerRight = useMemo(() => {
    if (!data) return null;

    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="ghost"
          onClick={() => nav("/employees")}
        >
          ← Employees
        </button>

        <button
          type="button"
          className="ghost"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        <button
          type="button"
          className="primary"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
    );
  }, [data, loading, nav]);

  const tabButton = (key, label, count) => (
    <button
      type="button"
      className={tab === key ? "primary" : "ghost"}
      onClick={() => setTab(key)}
      style={{ padding: "8px 12px" }}
    >
      {label} <span style={{ opacity: 0.85 }}>({count})</span>
    </button>
  );

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: "flex", gap: 14, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>
            Employee History
          </h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Visit timeline for BP, Checkups, and Inpatient records.
          </div>
        </div>
        {headerRight}
      </div>

      <div className="hr" />

      {/* Loading + errors */}
      {!data ? (
        <div className="card" style={{ opacity: 0.85 }}>
          {loading ? "Loading history..." : "No data yet."}
          {err && <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap", marginTop: 10 }}>{err}</div>}
        </div>
      ) : (
        <>
          {/* Employee summary */}
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    background: "linear-gradient(180deg, rgba(0,47,170,.18), rgba(0,47,170,.06))",
                    border: "1px solid rgba(0,47,170,.25)",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: ".2px" }}>
                    {employee?.full_name}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {employee?.employee_code ? `Code: ${employee.employee_code} • ` : ""}
                    {employee?.department ?? "—"}
                    {employee?.designation ? ` • ${employee.designation}` : ""}
                    {employee?.age != null ? ` • Age ${employee.age}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                <span className="badge blue">Inpatient: {data.totals.inpatient}</span>
                <span className="badge blue">BP: {data.totals.bp}</span>
                <span className="badge blue">Checkups: {data.totals.checkups}</span>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <label>
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>

              <label>
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>

              <button type="button" className="primary" onClick={load} disabled={loading}>
                {loading ? "Filtering..." : "Apply Filter"}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  // reload unfiltered immediately
                  setTimeout(load, 0);
                }}
                disabled={loading}
              >
                Clear Dates
              </button>
            </div>

            {err && <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{err}</div>}
          </div>

          <div className="hr" />

          {/* Tabs */}
          <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {tabButton("all", "All", data.totals.inpatient + data.totals.bp + data.totals.checkups)}
            {tabButton("inpatient", "Inpatient", data.totals.inpatient)}
            {tabButton("bp", "BP", data.totals.bp)}
            {tabButton("checkups", "Checkups", data.totals.checkups)}
          </div>

          <div className="hr" />

          {/* Tables */}
          {(tab === "all" || tab === "inpatient") && (
            <div className="card" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Inpatient Visits</h3>
                  <div className="muted" style={{ fontSize: 13 }}>Sorted and paginated for faster review.</div>
                </div>
                <span className="badge blue">{data.totals.inpatient} records</span>
              </div>

              <DataTable
                columns={[
                  { key: "visit_date", header: "Date", render: (r) => String(r.visit_date ?? "").slice(0, 10), sortValue: (r) => r.visit_date ?? "" },
                  { key: "visit_time", header: "Time" },
                  { key: "department", header: "Dept" },
                  { key: "chief_complaint", header: "Complaint" },
                  { key: "symptoms", header: "Symptoms", sortable: false },
                  { key: "disposition", header: "Evaluation" },
                ]}
                rows={data.inpatient}
                initialSortKey="visit_date"
                initialSortDir="desc"
                stickyHeader
                defaultPageSize={10}
                pageSizeOptions={[10, 15, 25, 50]}
                maxBodyHeight={420}
              />
            </div>
          )}

          {(tab === "all" || tab === "bp") && (
            <div className="card" style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ marginBottom: 6 }}>BP Logs</h3>
                  <div className="muted" style={{ fontSize: 13 }}>Click headers to sort by date or BP.</div>
                </div>
                <span className="badge blue">{data.totals.bp} records</span>
              </div>

              <DataTable
                columns={[
                  { key: "log_date", header: "Date", render: (r) => String(r.log_date ?? "").slice(0, 10), sortValue: (r) => r.log_date ?? "" },
                  { key: "log_time", header: "Time" },
                  { key: "bp_text", header: "BP" },
                  { key: "intervention", header: "Intervention", sortable: false },
                ]}
                rows={data.bp}
                initialSortKey="log_date"
                initialSortDir="desc"
                stickyHeader
                defaultPageSize={10}
                pageSizeOptions={[10, 15, 25, 50]}
                maxBodyHeight={420}
              />
            </div>
          )}

          {(tab === "all" || tab === "checkups") && (
            <div className="card" style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Checkups</h3>
                  <div className="muted" style={{ fontSize: 13 }}>Statuses can be sorted and reviewed quickly.</div>
                </div>
                <span className="badge blue">{data.totals.checkups} records</span>
              </div>

              <DataTable
                columns={[
                  { key: "request_date", header: "Date", render: (r) => String(r.request_date ?? "").slice(0, 10), sortValue: (r) => r.request_date ?? "" },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => <span className="badge blue">{r.status ?? ""}</span>,
                    sortValue: (r) => r.status ?? "",
                  },
                  { key: "symptoms", header: "Symptoms", sortable: false },
                  { key: "remarks", header: "Remarks", sortable: false },
                ]}
                rows={data.checkups}
                initialSortKey="request_date"
                initialSortDir="desc"
                stickyHeader
                defaultPageSize={10}
                pageSizeOptions={[10, 15, 25, 50]}
                maxBodyHeight={420}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}