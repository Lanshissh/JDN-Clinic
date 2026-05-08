import { useEffect, useMemo, useState } from "react";
import { apiGet, formatApiError } from "../api";
import EmployeeSelect from "../components/EmployeeSelect";
import DataTable from "../components/DataTable";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

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

// 37 symptom columns from the In-Patient Record template (In patient.xlsx)
const INPATIENT_SYMPTOM_COLS = [
  "Abdel Pain Acid", "Abd'l Pain Spasm", "Abd'l Pain Hypogastric, RUQ",
  "Ab'l Pain LBM/Constipation", "Allergy", "Animal Bite/Scratch/Insect",
  "Cough", "Body Malaise", "Colds", "Costochondritis", "Cough & Colds",
  "Cough, Colds, Fever", "Dizziness", "DOB (difficulty of breathing)",
  "Menstrual Cramps", "Dysuria", "Epistaxis", "Fainting",
  "Eyes, Conjunctivitis, Irritation", "Ear Pain/Irritation", "Fever",
  "Foot and Mouth Symptoms", "Muscle and Joint pain, Flu", "Headache",
  "Hyperventilation", "Hypertension", "Muscle pain", "Nausea",
  "Others", "Period Stain", "Sore Throat / Tonsils", "Sprain / Strain",
  "Stiff Neck", "Toothache", "Viral/Communicable", "Vomiting",
  "Wound / Accidents",
];

// Maps comma-separated symptoms text to per-column checkbox values (1 or 0)
function mapSymptomsToColumns(symptomsText) {
  const result = new Array(INPATIENT_SYMPTOM_COLS.length).fill(0);
  if (!symptomsText) return result;

  const othersIdx = INPATIENT_SYMPTOM_COLS.findIndex((c) => c === "Others");
  const parts = symptomsText.split(",").map((s) => s.trim().toLowerCase());
  const unmatched = [];

  for (const sym of parts) {
    if (!sym) continue;
    let matched = false;
    for (let i = 0; i < INPATIENT_SYMPTOM_COLS.length; i++) {
      const col = INPATIENT_SYMPTOM_COLS[i].toLowerCase();
      // Check if the symptom text is contained in the column name or vice versa
      const symClean = sym.replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
      const colClean = col.replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
      if (colClean.includes(symClean) || symClean.includes(colClean)) {
        result[i] = 1;
        matched = true;
        break;
      }
    }
    if (!matched) unmatched.push(sym);
  }

  if (unmatched.length > 0 && othersIdx >= 0) result[othersIdx] = 1;
  return result;
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

const REPORT_TEMPLATES = {
  inpatient: { file: "In patient.xlsx", sheet: "In-Patient Record", startRow: 3, columns: 52 },
  bp: { file: "BP.xlsx", sheet: "BP Monitoring", startRow: 1, columns: 7 },
  checkups: { file: "For check up.xlsx", sheet: "For Check-up", startRow: 1, columns: 5 },
};

function templateUrl(fileName) {
  const base = import.meta.env.BASE_URL || "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}templates/${encodeURIComponent(fileName)}`;
}

async function loadTemplateSheet({ file, sheet }) {
  const res = await fetch(templateUrl(file));
  if (!res.ok) throw new Error(`Unable to load report template: ${file}`);

  const buffer = await res.arrayBuffer();
  const wb = XLSX.read(buffer, { cellStyles: true, cellDates: true });
  const ws = wb.Sheets[sheet] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error(`Template has no worksheet: ${file}`);
  return ws;
}

function blankCell(cell = {}) {
  const next = { ...cell };
  delete next.v;
  delete next.w;
  delete next.t;
  delete next.f;
  return next;
}

function writeCell(ws, row, col, value, styleTemplate) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[addr] ? { ...ws[addr] } : blankCell(styleTemplate);
  if (!cell.s && styleTemplate?.s) cell.s = styleTemplate.s;

  delete cell.w;
  delete cell.f;

  if (value == null || value === "") {
    ws[addr] = blankCell(cell);
    return;
  }

  cell.v = value;
  cell.t = typeof value === "number" ? "n" : "s";
  ws[addr] = cell;
}

function fillTemplateRows(ws, { startRow, columns }, rows) {
  const existingRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
  const styleRow = [];
  for (let c = 0; c < columns; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: startRow, c });
    styleRow[c] = ws[addr] ? { ...ws[addr] } : {};
  }

  for (let r = startRow; r <= existingRange.e.r; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = blankCell(ws[addr] ?? styleRow[c]);
    }
  }

  rows.forEach((row, i) => {
    for (let c = 0; c < columns; c += 1) {
      writeCell(ws, startRow + i, c, row[c], styleRow[c]);
    }
  });

  const nextRange = {
    s: existingRange.s,
    e: {
      r: Math.max(existingRange.e.r, startRow + Math.max(rows.length, 1) - 1),
      c: Math.max(existingRange.e.c, columns - 1),
    },
  };
  ws["!ref"] = XLSX.utils.encode_range(nextRange);
}

async function saveTemplatedReportWorkbook({ filename, inpatientRows, bpRows, checkupRows }) {
  const [inpatientWs, bpWs, checkupsWs] = await Promise.all([
    loadTemplateSheet(REPORT_TEMPLATES.inpatient),
    loadTemplateSheet(REPORT_TEMPLATES.bp),
    loadTemplateSheet(REPORT_TEMPLATES.checkups),
  ]);

  fillTemplateRows(inpatientWs, REPORT_TEMPLATES.inpatient, inpatientRows);
  fillTemplateRows(bpWs, REPORT_TEMPLATES.bp, bpRows);
  fillTemplateRows(checkupsWs, REPORT_TEMPLATES.checkups, checkupRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, inpatientWs, REPORT_TEMPLATES.inpatient.sheet);
  XLSX.utils.book_append_sheet(wb, bpWs, REPORT_TEMPLATES.bp.sheet);
  XLSX.utils.book_append_sheet(wb, checkupsWs, REPORT_TEMPLATES.checkups.sheet);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`, { cellStyles: true });
}

export default function ReportsPage() {
  const [tab, setTab] = useState("analytics");

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
      setDailyErr(formatApiError(e));
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
      setMonthlyErr(formatApiError(e));
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
      setHistoryErr(formatApiError(e));
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ----- EXPORT: DAILY RANGE (uses clinic XLSX templates)
  async function exportDailyExcel() {
    if (!daily?.days?.length) return;

    const inpatientRows = [];
    const bpRows = [];
    const checkupRows = [];
    let checkupNum = 1;

    for (const day of daily.days) {
      const d = day?.date ?? "";

      for (const r of day.inpatient ?? []) {
        const symCols = mapSymptomsToColumns(r.symptoms);
        inpatientRows.push([
          String(r.visit_date ?? d).slice(0, 10),
          r.visit_time ?? "",
          r.name ?? "",
          r.age ?? "",
          r.department ?? "",
          r.chief_complaint ?? "",
          ...symCols,
          "",           // TEMP (not in DB)
          r.bp_text ?? "",
          "",           // PR (not in DB)
          "",           // RR (not in DB)
          "",           // O2 (not in DB)
          r.intervention ?? "",
          "",           // Medication (not in DB)
          r.disposition ?? "",
        ]);
      }

      for (const r of day.bp ?? []) {
        bpRows.push([
          String(r.log_date ?? d).slice(0, 10),
          r.employee_name ?? "",
          r.age ?? "",
          r.designation ?? "",
          r.log_time ?? "",
          r.bp_text ?? "",
          r.intervention ?? "",
        ]);
      }

      for (const r of day.checkups ?? []) {
        checkupRows.push([
          checkupNum++,
          String(r.request_date ?? d).slice(0, 10),
          r.employee_name ?? "",
          r.symptoms ?? "",
          r.remarks ?? "",
        ]);
      }
    }

    try {
      await saveTemplatedReportWorkbook({
        filename: `daily-report-${daily.from}-to-${daily.to}.xlsx`,
        inpatientRows,
        bpRows,
        checkupRows,
      });
    } catch (e) {
      alert(formatApiError(e));
    }
  }

  // ----- EXPORT: MONTHLY (XLSX single sheet)
  function exportMonthlyExcel() {
    if (!monthly) return;

    const t = monthly.totals ?? {};
    const summaryAoa = [
      ["Monthly Summary", monthly.month ?? month],
      [],
      ["Metric", "Count"],
      ["Inpatient", t.inpatient ?? 0],
      ["BP Logs", t.bp ?? 0],
      ["Checkups (Total)", t.checkups ?? 0],
      ["Checkups (Done)", t.checkups_done ?? 0],
      ["Checkups (Open)", t.checkups_open ?? 0],
      ["Checkups (Follow-up)", t.checkups_followup ?? 0],
      [],
      ["BP Summary"],
      ["Avg Systolic", monthly.bp_summary?.avg_systolic ?? "-"],
      ["Avg Diastolic", monthly.bp_summary?.avg_diastolic ?? "-"],
      ["High BP Count", monthly.bp_summary?.high_bp_count ?? 0],
    ];

    const symptomsAoa = [
      ["Top Symptoms", monthly.month ?? month],
      [],
      ["Symptom", "Count"],
      ...(monthly.top_symptoms ?? []).map((s) => [s.name, s.count]),
    ];

    const deptAoa = [
      ["Inpatient by Department", monthly.month ?? month],
      [],
      ["Department", "Count"],
      ...(monthly.department_breakdown ?? []).map((d) => [d.department, d.count]),
    ];

    saveWorkbook({
      filename: `monthly-summary-${monthly.month ?? month}.xlsx`,
      sheets: [
        { name: "SUMMARY", aoa: summaryAoa },
        { name: "TOP SYMPTOMS", aoa: symptomsAoa },
        { name: "DEPARTMENTS", aoa: deptAoa },
      ],
    });
  }

  // ----- EXPORT: EMPLOYEE HISTORY (uses clinic XLSX templates)
  async function exportHistoryExcel() {
    if (!history) return;

    const emp = history.employee ?? {};
    const empFullName = emp.full_name ?? empName ?? "";
    const inpatientRows = [];
    const bpRows = [];
    const checkupRows = [];

    for (const r of history.inpatient ?? []) {
      const symCols = mapSymptomsToColumns(r.symptoms);
      inpatientRows.push([
        String(r.visit_date ?? "").slice(0, 10),
        r.visit_time ?? "",
        r.name ?? empFullName,
        r.age ?? "",
        r.department ?? "",
        r.chief_complaint ?? "",
        ...symCols,
        "",
        r.bp_text ?? "",
        "", "", "",
        r.intervention ?? "",
        "",
        r.disposition ?? "",
      ]);
    }

    for (const r of history.bp ?? []) {
      bpRows.push([
        String(r.log_date ?? "").slice(0, 10),
        r.employee_name ?? empFullName,
        r.age ?? "",
        r.designation ?? "",
        r.log_time ?? "",
        r.bp_text ?? "",
        r.intervention ?? "",
      ]);
    }

    let checkupNum = 1;
    for (const r of history.checkups ?? []) {
      checkupRows.push([
        checkupNum++,
        String(r.request_date ?? "").slice(0, 10),
        r.employee_name ?? empFullName,
        r.symptoms ?? "",
        r.remarks ?? "",
      ]);
    }

    const nameSlug = empFullName.replace(/\s+/g, "-").toLowerCase() || "employee";

    try {
      await saveTemplatedReportWorkbook({
        filename: `employee-history-${nameSlug}.xlsx`,
        inpatientRows,
        bpRows,
        checkupRows,
      });
    } catch (e) {
      alert(formatApiError(e));
    }
  }

  // ----- PDF EXPORT
  function exportPdf() {
    window.print();
  }

  // ----- ANALYTICS
  const [analyticsMonth, setAnalyticsMonth] = useState(isoMonthToday());
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsErr, setAnalyticsErr] = useState("");

  async function loadAnalytics() {
    setAnalyticsErr("");
    setAnalyticsLoading(true);
    try {
      const r = await apiGet(`/api/reports/analytics?month=${analyticsMonth}`);
      setAnalytics(r);
    } catch (e) {
      setAnalyticsErr(formatApiError(e));
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  // Auto-load when tab changes (or on first mount)
  useEffect(() => {
    if (tab === "analytics") loadAnalytics();
    if (tab === "monthly") loadMonthly();
    if (tab === "daily") loadDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabs = useMemo(
    () => [
      { key: "analytics", label: "Analytics" },
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
          <h2 style={{ marginBottom: 6 }}>Analytics & Reports</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Export clinic summaries and employee histories.
          </div>
        </div>

        <div data-tour="reports-tabs" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {tabs.map((t) => tabBtn(t.key, t.label))}
        </div>
      </div>

      <div className="hr" />

      {/* ANALYTICS */}
      {tab === "analytics" && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Inline controls */}
          <div data-tour="analytics-controls" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="month"
              value={analyticsMonth}
              onChange={(e) => setAnalyticsMonth(e.target.value)}
              onBlur={loadAnalytics}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 }}
            />
            <button className="ghost" onClick={loadAnalytics} disabled={analyticsLoading} style={{ padding: "8px 14px" }}>
              {analyticsLoading ? "Refreshing..." : "Refresh"}
            </button>
            {analyticsErr && <span style={{ color: "var(--danger)", fontSize: 13 }}>{analyticsErr}</span>}
            {analyticsLoading && !analytics && <span className="muted" style={{ fontSize: 13 }}>Loading analytics…</span>}
          </div>

          {analyticsLoading && !analytics ? (
            <div style={{ display: "grid", gap: 12 }}>
              {[160, 260, 220].map((h, i) => (
                <div key={i} style={{ height: h, borderRadius: 12, background: "linear-gradient(90deg, var(--line) 25%, var(--surface-soft) 50%, var(--line) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
              ))}
            </div>
          ) : !analytics ? (
            <div className="card muted" style={{ fontSize: 13 }}>No data for this month yet.</div>
          ) : (
            <>
              {/* KPI Cards */}
              <div data-tour="analytics-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                {[
                  { label: "Inpatient", value: analytics.totals.inpatient, color: "#0f6b7a" },
                  { label: "BP Logs", value: analytics.totals.bp, color: "#b86e00" },
                  { label: "Checkups", value: analytics.totals.checkups, color: "#147a4c" },
                  { label: "High BP", value: analytics.bp_summary?.high_count ?? 0, color: "#b42318" },
                ].map((k) => (
                  <div key={k.label} className="card" style={{ boxShadow: "none", borderLeft: `4px solid ${k.color}`, paddingLeft: 14 }}>
                    <div className="muted" style={{ fontSize: 12 }}>{k.label}</div>
                    <div style={{ fontSize: 32, fontWeight: 950, color: k.color }}>{k.value}</div>
                  </div>
                ))}
                {analytics.bp_summary?.avg_systolic != null && (
                  <div className="card" style={{ boxShadow: "none", borderLeft: "4px solid #b86e00", paddingLeft: 14 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Avg BP</div>
                    <div style={{ fontSize: 22, fontWeight: 950, color: "#b86e00" }}>
                      {analytics.bp_summary.avg_systolic}/{analytics.bp_summary.avg_diastolic}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>mmHg</div>
                  </div>
                )}
              </div>

              {/* Daily Activity Bar Chart */}
              <div data-tour="analytics-daily-chart" className="card" style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Daily Activity — {analytics.month}</div>
                  <div className="muted" style={{ fontSize: 13 }}>Inpatient, BP, and Checkup visits per day.</div>
                </div>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.daily_trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={6}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.07)" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="inpatient" name="Inpatient" fill="#0f6b7a" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="bp" name="BP" fill="#b86e00" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="checkups" name="Checkups" fill="#147a4c" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div data-tour="analytics-donuts" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                {/* Checkup Status Donut */}
                {analytics.checkup_status?.length > 0 && (
                  <div className="card" style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>Checkup Status</div>
                      <div className="muted" style={{ fontSize: 13 }}>Done vs Open vs Follow-up.</div>
                    </div>
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics.checkup_status} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {analytics.checkup_status.map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v, name) => [v, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                      {analytics.checkup_status.map((s) => (
                        <span key={s.label} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                          {s.label}: <b>{s.value}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* BP Classification Donut */}
                {analytics.bp_classification?.length > 0 && (
                  <div className="card" style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>BP Classification</div>
                      <div className="muted" style={{ fontSize: 13 }}>Normal / Elevated / High.</div>
                    </div>
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics.bp_classification} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {analytics.bp_classification.map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v, name) => [v, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                      {analytics.bp_classification.map((s) => (
                        <span key={s.label} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                          {s.label}: <b>{s.value}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top Symptoms Bar Chart */}
              {analytics.top_symptoms?.length > 0 ? (
                <div data-tour="analytics-symptoms" className="card" style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Top Symptoms</div>
                    <div className="muted" style={{ fontSize: 13 }}>Most reported symptoms from checkup records.</div>
                  </div>
                  <div style={{ width: "100%", height: Math.max(200, analytics.top_symptoms.length * 36) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.top_symptoms} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.07)" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Cases" fill="#0f6b7a" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div data-tour="analytics-symptoms" className="card muted" style={{ fontSize: 13 }}>
                  No symptom trends for this month yet.
                </div>
              )}

              {/* Department Breakdown Bar Chart */}
              {analytics.department_breakdown?.length > 0 && (
                <div className="card" style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Inpatient by Department</div>
                    <div className="muted" style={{ fontSize: 13 }}>Which departments had the most visits.</div>
                  </div>
                  <div style={{ width: "100%", height: Math.max(200, analytics.department_breakdown.length * 42) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.department_breakdown} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.07)" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="department" width={130} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Visits" fill="#b86e00" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              From
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              To
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 }} />
            </label>
            <button type="button" className="primary" onClick={loadDaily} disabled={dailyLoading} style={{ padding: "8px 16px" }}>
              {dailyLoading ? "Loading..." : "Load"}
            </button>
            <button type="button" className="ghost" onClick={() => setDaily(null)} disabled={dailyLoading} style={{ padding: "8px 12px" }}>
              Clear
            </button>
          </div>

          {dailyErr && <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{dailyErr}</div>}

          {dailyLoading && !daily ? (
            <div className="muted" style={{ fontSize: 13 }}>Loading daily report…</div>
          ) : !daily?.days?.length ? (
            <div className="muted" style={{ fontSize: 13 }}>No records for this date range.</div>
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
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              onBlur={loadMonthly}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 }}
            />
            <button type="button" className="ghost" onClick={loadMonthly} disabled={monthlyLoading} style={{ padding: "8px 14px" }}>
              {monthlyLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {monthlyErr && <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{monthlyErr}</div>}

          {monthlyLoading && !monthly ? (
            <div className="muted" style={{ fontSize: 13 }}>Loading summary…</div>
          ) : !monthly ? (
            <div className="muted" style={{ fontSize: 13 }}>No data for this month.</div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {/* Totals row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div className="card" style={{ boxShadow: "none" }}>
                  <div className="muted" style={{ fontSize: 13 }}>Inpatient</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{monthly.totals?.inpatient ?? 0}</div>
                </div>
                <div className="card" style={{ boxShadow: "none" }}>
                  <div className="muted" style={{ fontSize: 13 }}>BP Logs</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{monthly.totals?.bp ?? 0}</div>
                  {monthly.bp_summary?.avg_systolic != null && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Avg: <b>{monthly.bp_summary.avg_systolic}/{monthly.bp_summary.avg_diastolic} mmHg</b>
                      {monthly.bp_summary.high_bp_count > 0 && (
                        <span style={{ color: "var(--danger)", marginLeft: 6 }}>High: {monthly.bp_summary.high_bp_count}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="card" style={{ boxShadow: "none" }}>
                  <div className="muted" style={{ fontSize: 13 }}>Checkups</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{monthly.totals?.checkups ?? 0}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Done: <b>{monthly.totals?.checkups_done ?? 0}</b> | Open: <b>{monthly.totals?.checkups_open ?? 0}</b> | Follow-up: <b>{monthly.totals?.checkups_followup ?? 0}</b>
                  </div>
                </div>
              </div>

              {/* Top Symptoms */}
              {(monthly.top_symptoms ?? []).length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Top Symptoms This Month</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {monthly.top_symptoms.map((s) => (
                      <div key={s.name} style={{ background: "var(--brand-soft)", border: "1px solid rgba(15,107,122,.2)", borderRadius: 8, padding: "5px 12px", fontSize: 13 }}>
                        <b>{s.count}×</b> {s.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Department Breakdown */}
              {(monthly.department_breakdown ?? []).length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Inpatient by Department</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {monthly.department_breakdown.map((d) => (
                      <div key={d.department} style={{ background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 12px", fontSize: 13 }}>
                        <b>{d.count}</b> — {d.department}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
        Tip: Change the month picker to reload data automatically. PDF export opens the browser print dialog.
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
