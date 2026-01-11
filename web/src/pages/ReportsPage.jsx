import { useMemo, useState } from "react";
import { apiGet } from "../api";
import EmployeeSelect from "../components/EmployeeSelect";
import DataTable from "../components/DataTable";
import * as XLSX from "xlsx";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function isoMonthToday() {
  return new Date().toISOString().slice(0, 7);
}

function Section({ title, right, children }) {
  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ marginBottom: 6 }}>{title}</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            Generate, export, and print in one place.
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function ExportButtons({
  disabled,
  onExportExcel,
  onExportPdf,
  excelLabel = "Export Excel",
  pdfLabel = "Export PDF",
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button
        type="button"
        className="ghost"
        onClick={onExportExcel}
        disabled={disabled}
      >
        {excelLabel}
      </button>
      <button
        type="button"
        className="primary"
        onClick={onExportPdf}
        disabled={disabled}
      >
        {pdfLabel}
      </button>
    </div>
  );
}

function dateRange(from, to) {
  if (!from || !to) return [];
  const out = [];
  const d = new Date(from);
  const end = new Date(to);

  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime())) return [];

  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** XLSX helpers */
function makeSheet(aoa) {
  return XLSX.utils.aoa_to_sheet(aoa);
}

function autoWidth(ws, aoa) {
  const cols = [];
  for (const row of aoa) {
    (row || []).forEach((cell, i) => {
      const len = cell == null ? 0 : String(cell).length;
      cols[i] = Math.max(cols[i] ?? 10, Math.min(60, len + 2));
    });
  }
  ws["!cols"] = cols.map((w) => ({ wch: w }));
}

function saveWorkbook({ filename, sheets }) {
  // sheets: [{ name, aoa }]
  const wb = XLSX.utils.book_new();

  for (const s of sheets) {
    const ws = makeSheet(s.aoa);
    autoWidth(ws, s.aoa);
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }

  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export default function ReportsPage() {
  const [tab, setTab] = useState("daily"); // daily | monthly | employee

  // ----- DAILY (RANGE)
  const [fromDate, setFromDate] = useState(isoToday());
  const [toDate, setToDate] = useState(isoToday());

  // dailyRange = { from, to, days: [dailyReportResponse...] }
  const [daily, setDaily] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyErr, setDailyErr] = useState("");

  async function loadDaily() {
    setDailyErr("");

    if (!fromDate || !toDate) {
      setDailyErr("Please select From and To dates.");
      return;
    }
    if (fromDate > toDate) {
      setDailyErr("From date must be earlier than or equal to To date.");
      return;
    }

    setDailyLoading(true);
    try {
      const days = dateRange(fromDate, toDate);

      const results = [];
      for (const d of days) {
        const r = await apiGet(`/api/reports/daily?date=${d}`);
        results.push(r);
      }

      setDaily({ from: fromDate, to: toDate, days: results });
    } catch (e) {
      setDailyErr(String(e));
      setDaily(null);
    } finally {
      setDailyLoading(false);
    }
  }

  // ----- MONTHLY
  const [month, setMonth] = useState(isoMonthToday());
  const [monthly, setMonthly] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyErr, setMonthlyErr] = useState("");

  async function loadMonthly() {
    setMonthlyErr("");
    setMonthlyLoading(true);
    try {
      const r = await apiGet(`/api/reports/monthly?month=${month}`);
      setMonthly(r);
    } catch (e) {
      setMonthlyErr(String(e));
      setMonthly(null);
    } finally {
      setMonthlyLoading(false);
    }
  }

  // ----- EMPLOYEE HISTORY
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState("");

  async function loadHistory() {
    setHistoryErr("");
    if (!empId) {
      setHistoryErr("Select an employee first.");
      return;
    }
    setHistoryLoading(true);

    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const r = await apiGet(`/api/employees/${empId}/history?${qs.toString()}`);
      setHistory(r);
    } catch (e) {
      setHistoryErr(String(e));
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ----- EXPORT: DAILY RANGE (XLSX with 3 sheets)
  function exportDailyExcel() {
    if (!daily?.days?.length) return;

    const inpatientAoa = [
      [`Daily Report (Range): ${daily.from} → ${daily.to}`],
      [],
      ["Date", "Time", "Name", "Dept", "Complaint", "Evaluation", "Symptoms", "Intervention", "Notes"],
    ];

    const bpAoa = [
      [`Daily Report (Range): ${daily.from} → ${daily.to}`],
      [],
      ["Date", "Time", "Name", "Age", "Designation", "BP", "Intervention"],
    ];

    const checkupsAoa = [
      [`Daily Report (Range): ${daily.from} → ${daily.to}`],
      [],
      ["Date", "Name", "Symptoms", "Status", "Remarks"],
    ];

    for (const day of daily.days) {
      const d = day?.date ?? "";

      for (const r of day.inpatient ?? []) {
        inpatientAoa.push([
          d,
          r.visit_time ?? "",
          r.name ?? "",
          r.department ?? "",
          r.chief_complaint ?? "",
          r.disposition ?? "",
          r.symptoms ?? "",
          r.intervention ?? "",
          r.notes ?? "",
        ]);
      }

      for (const r of day.bp ?? []) {
        bpAoa.push([
          d,
          r.log_time ?? "",
          r.employee_name ?? "",
          r.age ?? "",
          r.designation ?? "",
          r.bp_text ?? "",
          r.intervention ?? "",
        ]);
      }

      for (const r of day.checkups ?? []) {
        checkupsAoa.push([
          d,
          r.employee_name ?? "",
          r.symptoms ?? "",
          r.status ?? "",
          r.remarks ?? "",
        ]);
      }
    }

    saveWorkbook({
      filename: `daily-report-${daily.from}-to-${daily.to}.xlsx`,
      sheets: [
        { name: "INPATIENT", aoa: inpatientAoa },
        { name: "BP", aoa: bpAoa },
        { name: "CHECKUPS", aoa: checkupsAoa },
      ],
    });
  }

  // ----- EXPORT: MONTHLY (XLSX single sheet)
  function exportMonthlyExcel() {
    if (!monthly) return;

    const t = monthly.totals ?? {};
    const aoa = [
      ["Monthly Summary", monthly.month ?? month],
      [],
      ["Metric", "Count"],
      ["Inpatient", t.inpatient ?? 0],
      ["BP", t.bp ?? 0],
      ["Checkups", t.checkups ?? 0],
      ["Checkups (done)", t.checkups_done ?? 0],
      ...(t.checkups_open != null ? [["Checkups (open)", t.checkups_open]] : []),
      ...(t.checkups_followup != null ? [["Checkups (followup)", t.checkups_followup]] : []),
    ];

    saveWorkbook({
      filename: `monthly-summary-${monthly.month ?? month}.xlsx`,
      sheets: [{ name: "SUMMARY", aoa }],
    });
  }

  // ----- EXPORT: EMPLOYEE HISTORY (XLSX with 3 sheets)
  function exportHistoryExcel() {
    if (!history) return;

    const emp = history.employee ?? {};
    const header = [
      [`Employee History: ${emp.full_name ?? empName ?? ""}`],
      [`Filter: ${from || "—"} → ${to || "—"}`],
      [],
    ];

    const inpatientAoa = [
      ...header,
      ["Date", "Time", "Dept", "Complaint", "Symptoms", "BP", "Intervention", "Evaluation", "Notes"],
    ];

    const bpAoa = [
      ...header,
      ["Date", "Time", "BP", "Intervention"],
    ];

    const checkupsAoa = [
      ...header,
      ["Date", "Name", "Status", "Symptoms", "Remarks"],
    ];

    for (const r of history.inpatient ?? []) {
      inpatientAoa.push([
        r.visit_date ?? "",
        r.visit_time ?? "",
        r.department ?? "",
        r.chief_complaint ?? "",
        r.symptoms ?? "",
        r.bp_text ?? "",
        r.intervention ?? "",
        r.disposition ?? "",
        r.notes ?? "",
      ]);
    }

    for (const r of history.bp ?? []) {
      bpAoa.push([
        r.log_date ?? "",
        r.log_time ?? "",
        r.bp_text ?? "",
        r.intervention ?? "",
      ]);
    }

    for (const r of history.checkups ?? []) {
      checkupsAoa.push([
        r.request_date ?? "",
        r.employee_name ?? "",
        r.status ?? "",
        r.symptoms ?? "",
        r.remarks ?? "",
      ]);
    }

    const nameSlug = (emp.full_name ?? empName ?? "employee")
      .replace(/\s+/g, "-")
      .toLowerCase();

    saveWorkbook({
      filename: `employee-history-${nameSlug}.xlsx`,
      sheets: [
        { name: "INPATIENT", aoa: inpatientAoa },
        { name: "BP", aoa: bpAoa },
        { name: "CHECKUPS", aoa: checkupsAoa },
      ],
    });
  }

  // ----- PDF EXPORT
  function exportPdf() {
    window.print();
  }

  const tabs = useMemo(
    () => [
      { key: "daily", label: "Daily Report" },
      { key: "monthly", label: "Monthly Summary" },
      { key: "employee", label: "Employee History" },
    ],
    []
  );

  const tabBtn = (k, label) => (
    <button
      type="button"
      className={tab === k ? "primary" : "ghost"}
      onClick={() => setTab(k)}
      style={{ padding: "8px 12px" }}
    >
      {label}
    </button>
  );

  const dailyUiTotals = useMemo(() => {
    if (!daily?.days?.length) return null;
    return daily.days.reduce(
      (acc, d) => {
        acc.inpatient += d?.totals?.inpatient ?? 0;
        acc.bp += d?.totals?.bp ?? 0;
        acc.checkups += d?.totals?.checkups ?? 0;
        return acc;
      },
      { inpatient: 0, bp: 0, checkups: 0 }
    );
  }, [daily]);

  return (
    <div className="container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginBottom: 6 }}>Reports</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            One-click export to Excel (.xlsx) and PDF (Print → Save as PDF).
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {tabs.map((t) => tabBtn(t.key, t.label))}
        </div>
      </div>

      <div className="hr" />

      {/* DAILY */}
      {tab === "daily" && (
        <Section
          title="Daily Report (Range)"
          right={
            <ExportButtons
              disabled={!daily?.days?.length}
              onExportExcel={exportDailyExcel}
              onExportPdf={exportPdf}
              excelLabel="Export Excel (.xlsx)"
              pdfLabel="Export PDF"
            />
          }
        >
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <label>
              From
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>

            <label>
              To
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="primary"
              onClick={loadDaily}
              disabled={dailyLoading}
            >
              {dailyLoading ? "Loading..." : "Load"}
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() => setDaily(null)}
              disabled={dailyLoading}
            >
              Clear
            </button>
          </div>

          {dailyErr && (
            <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>
              {dailyErr}
            </div>
          )}

          {!daily?.days?.length ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Load a date range to view the report.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="badge blue">Range Inpatient: {dailyUiTotals?.inpatient ?? 0}</span>
                <span className="badge blue">Range BP: {dailyUiTotals?.bp ?? 0}</span>
                <span className="badge blue">Range Checkups: {dailyUiTotals?.checkups ?? 0}</span>
              </div>

              <div className="hr" />

              {daily.days.map((day) => (
                <div key={day.date ?? Math.random()} style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>Date: {day.date}</h3>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span className="badge blue">Inpatient: {day.totals?.inpatient ?? 0}</span>
                      <span className="badge blue">BP: {day.totals?.bp ?? 0}</span>
                      <span className="badge blue">Checkups: {day.totals?.checkups ?? 0}</span>
                    </div>
                  </div>

                  <h3>Inpatient</h3>
                  <DataTable
                    columns={[
                      { key: "visit_time", header: "Time" },
                      { key: "name", header: "Name" },
                      { key: "department", header: "Dept" },
                      { key: "chief_complaint", header: "Complaint" },
                      { key: "disposition", header: "Evaluation" },
                    ]}
                    rows={day.inpatient ?? []}
                    stickyHeader
                    defaultPageSize={10}
                    pageSizeOptions={[10, 15, 25, 50]}
                    maxBodyHeight={300}
                  />

                  <h3 style={{ marginTop: 8 }}>BP</h3>
                  <DataTable
                    columns={[
                      { key: "log_time", header: "Time" },
                      { key: "employee_name", header: "Name" },
                      { key: "bp_text", header: "BP" },
                      { key: "intervention", header: "Intervention", sortable: false },
                    ]}
                    rows={day.bp ?? []}
                    stickyHeader
                    defaultPageSize={10}
                    pageSizeOptions={[10, 15, 25, 50]}
                    maxBodyHeight={300}
                  />

                  <h3 style={{ marginTop: 8 }}>Checkups</h3>
                  <DataTable
                    columns={[
                      { key: "employee_name", header: "Name" },
                      { key: "symptoms", header: "Symptoms", sortable: false },
                      { key: "status", header: "Status" },
                      { key: "remarks", header: "Remarks", sortable: false },
                    ]}
                    rows={day.checkups ?? []}
                    stickyHeader
                    defaultPageSize={10}
                    pageSizeOptions={[10, 15, 25, 50]}
                    maxBodyHeight={300}
                  />

                  <div className="hr" />
                </div>
              ))}
            </>
          )}
        </Section>
      )}

      {/* MONTHLY */}
      {tab === "monthly" && (
        <Section
          title="Monthly Summary"
          right={
            <ExportButtons
              disabled={!monthly}
              onExportExcel={exportMonthlyExcel}
              onExportPdf={exportPdf}
              excelLabel="Export Excel (.xlsx)"
              pdfLabel="Export PDF"
            />
          }
        >
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <label>
              Month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="primary"
              onClick={loadMonthly}
              disabled={monthlyLoading}
            >
              {monthlyLoading ? "Loading..." : "Load"}
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() => setMonthly(null)}
              disabled={monthlyLoading}
            >
              Clear
            </button>
          </div>

          {monthlyErr && (
            <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>
              {monthlyErr}
            </div>
          )}

          {!monthly ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Load a month to view the summary.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>Inpatient</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{monthly.totals?.inpatient ?? 0}</div>
              </div>

              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>BP Logs</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{monthly.totals?.bp ?? 0}</div>
              </div>

              <div className="card" style={{ boxShadow: "none" }}>
                <div className="muted" style={{ fontSize: 13 }}>Checkups</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{monthly.totals?.checkups ?? 0}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Done: <b>{monthly.totals?.checkups_done ?? 0}</b>
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* EMPLOYEE HISTORY */}
      {tab === "employee" && (
        <Section
          title="Employee History"
          right={
            <ExportButtons
              disabled={!history}
              onExportExcel={exportHistoryExcel}
              onExportPdf={exportPdf}
              excelLabel="Export Excel (.xlsx)"
              pdfLabel="Export PDF"
            />
          }
        >
          <div style={{ display: "grid", gap: 12 }}>
            <EmployeeSelect
              valueId={empId}
              onChange={(emp) => {
                setEmpId(emp?.id ?? "");
                setEmpName(emp?.full_name ?? "");
                setHistory(null);
                setHistoryErr("");
              }}
              label="Select Employee"
            />

            <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <label>
                From (optional)
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                To (optional)
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>

              <button
                type="button"
                className="primary"
                onClick={loadHistory}
                disabled={historyLoading}
              >
                {historyLoading ? "Loading..." : "Load"}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setHistory(null);
                  setHistoryErr("");
                }}
                disabled={historyLoading}
              >
                Clear
              </button>
            </div>

            {historyErr && (
              <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>
                {historyErr}
              </div>
            )}

            {!history ? (
              <div className="muted" style={{ fontSize: 13 }}>
                Select an employee and click Load to view history.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span className="badge blue">Inpatient: {history.totals?.inpatient ?? 0}</span>
                  <span className="badge blue">BP: {history.totals?.bp ?? 0}</span>
                  <span className="badge blue">Checkups: {history.totals?.checkups ?? 0}</span>
                </div>

                <div className="hr" />

                <h3>Inpatient</h3>
                <DataTable
                  columns={[
                    { key: "visit_date", header: "Date", render: (r) => String(r.visit_date ?? "").slice(0, 10) },
                    { key: "visit_time", header: "Time" },
                    { key: "department", header: "Dept" },
                    { key: "chief_complaint", header: "Complaint" },
                    { key: "disposition", header: "Evaluation" },
                  ]}
                  rows={history.inpatient ?? []}
                  stickyHeader
                  defaultPageSize={10}
                  pageSizeOptions={[10, 15, 25, 50]}
                  maxBodyHeight={320}
                />

                <h3 style={{ marginTop: 18 }}>BP</h3>
                <DataTable
                  columns={[
                    { key: "log_date", header: "Date", render: (r) => String(r.log_date ?? "").slice(0, 10) },
                    { key: "log_time", header: "Time" },
                    { key: "bp_text", header: "BP" },
                    { key: "intervention", header: "Intervention", sortable: false },
                  ]}
                  rows={history.bp ?? []}
                  stickyHeader
                  defaultPageSize={10}
                  pageSizeOptions={[10, 15, 25, 50]}
                  maxBodyHeight={320}
                />

                <h3 style={{ marginTop: 18 }}>Checkups</h3>
                <DataTable
                  columns={[
                    { key: "request_date", header: "Date", render: (r) => String(r.request_date ?? "").slice(0, 10) },
                    { key: "status", header: "Status" },
                    { key: "symptoms", header: "Symptoms", sortable: false },
                    { key: "remarks", header: "Remarks", sortable: false },
                  ]}
                  rows={history.checkups ?? []}
                  stickyHeader
                  defaultPageSize={10}
                  pageSizeOptions={[10, 15, 25, 50]}
                  maxBodyHeight={320}
                />
              </>
            )}
          </div>
        </Section>
      )}

      <div style={{ marginTop: 12 }} className="muted">
        PDF export uses your browser print dialog → choose <b>Save as PDF</b>.
      </div>
    </div>
  );
}