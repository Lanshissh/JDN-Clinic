import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// ─── Tour definitions per route ──────────────────────────────────────────────
const TOURS = {
  "/": [
    { target: "dash-stats",        title: "Today's Stats",       body: "These 4 cards show today's total Inpatient visits, BP logs, Checkups, and active employees. The sparkline shows the last 7-day trend." },
    { target: "dash-alerts",       title: "Alerts",              body: "Automatic alerts appear here for: High BP readings, employee birthdays, many open checkups, overdue follow-ups, and low inventory stock." },
    { target: "dash-monthly",      title: "Monthly Summary",     body: "See this month's totals for Inpatient, BP, and Checkups — including how many are Done, Open, or Follow-up." },
    { target: "dash-quickactions", title: "Page Actions",        body: "Refresh the dashboard data or jump straight to the Reports page from here." },
  ],
  "/inpatient": [
    { target: "inpatient-add-btn", title: "Add a Visit",         body: "Click here to record a new inpatient visit. Fill in the date, patient name, department, chief complaint, BP, symptoms, and disposition." },
    { target: "inpatient-filters", title: "Filter Records",      body: "Use Filters to narrow down records by date range or patient name. Click Refresh any time to reload the list." },
    { target: "inpatient-table",   title: "Visit Records",       body: "All inpatient visits are listed here. Click Edit to update a record, or Delete to remove it. Click any row to go to that employee's history." },
  ],
  "/bp": [
    { target: "bp-add-btn",   title: "Add a BP Reading",    body: "Click here to log a new BP reading. Enter the employee name, BP value (e.g. 120/80), date, time, and intervention notes." },
    { target: "bp-filters",   title: "Filter BP Logs",      body: "Filter BP logs by date range and employee name. Readings of 140/90 or higher are flagged as High BP." },
    { target: "bp-table",     title: "BP Log Table",        body: "All BP readings are listed here. High readings (≥140/90) are highlighted in red. Click an employee row to see their BP trend chart." },
  ],
  "/checkups": [
    { target: "checkups-add-btn", title: "Add a Checkup",       body: "Click here to record a new checkup request. Select the employee, choose the date and status, then enter symptoms and remarks." },
    { target: "checkups-filters", title: "Filter & Refresh",    body: "Use Filters to search by date, name, or status (open / done / followup). The status filter is useful for finding pending follow-ups." },
    { target: "checkups-table",   title: "Checkup Records",     body: "All checkup records are listed here. Click the checkbox on a row to select it. The Print button on each row opens a printable record." },
    { target: "checkups-bulk",    title: "Bulk Status Update",  body: "When one or more rows are checked, this action bar appears. Choose a status and click Apply to update all selected records at once." },
  ],
  "/employees": [
    { target: "employees-add-btn", title: "Add an Employee",    body: "Click here to add a new employee to the master list. Fill in their name, department, designation, and birthday." },
    { target: "employees-search",  title: "Search Employees",   body: "Type a name here and click Search to filter the active employee list. Clear resets the list." },
    { target: "employees-table",   title: "Employee List",      body: "All employees are listed here. Click any row to open their full health history — BP trends, checkups, and inpatient visits." },
  ],
  "/employees/:id": [
    { target: "history-summary",   title: "Employee Summary",    body: "This card shows the selected employee's basic details and total counts for Inpatient, BP, and Checkup records." },
    { target: "history-filters",   title: "Date Filters",        body: "Use From and To dates to narrow the history timeline, then apply the filter to reload the records." },
    { target: "history-tabs",      title: "History Sections",    body: "Switch between All records, Inpatient visits, BP logs, and Checkups to focus the page." },
    { target: "history-inpatient", title: "Inpatient Visits",    body: "Review inpatient visit details here. Image controls are available in the Images column when records have attachments." },
    { target: "history-bp",        title: "BP Trend and Logs",    body: "BP records are shown here, with a trend chart when there are enough readings for the employee." },
    { target: "history-checkups",  title: "Checkup Records",     body: "Checkup status, symptoms, remarks, and uploaded images can be reviewed from this section." },
  ],
  "/inventory": [
    { target: "inventory-add-btn", title: "Add an Item",        body: "Click here to add a medicine or supply to the inventory. Set the quantity and the low-stock alert threshold." },
    { target: "inventory-table",   title: "Inventory List",     body: "Items at or below the low-stock threshold show a ⚠ symbol. Click Dispense to deduct stock, or Logs to see who received the item." },
  ],
  "/reports": [
    { target: "reports-tabs",          title: "Report Sections",     body: "Switch between Analytics (charts), Daily Report (date range), Monthly Summary (totals), and Employee History here." },
    { target: "analytics-controls",    title: "Select a Month",      body: "Pick a month using this picker. Charts load automatically — change the month to instantly reload all analytics." },
    { target: "analytics-kpi",         title: "Key Numbers",         body: "These cards show the total Inpatient visits, BP logs, Checkups, High BP count, and average BP for the selected month." },
    { target: "analytics-daily-chart", title: "Daily Activity Chart",body: "This bar chart shows how many Inpatient, BP, and Checkup records were created each day of the month." },
    { target: "analytics-donuts",      title: "Checkup & BP Charts", body: "The left donut shows Checkup status (Done/Open/Follow-up). The right donut shows BP classification (Normal/Elevated/High)." },
    { target: "analytics-symptoms",    title: "Top Symptoms",        body: "This horizontal bar chart shows the most reported symptoms from checkup records for the month — most common at the top." },
  ],
  "/search": [
    { target: "search-input",   title: "Search by Name",      body: "Type any employee name here and press Enter or click Search. Results appear across all record types: Employees, Checkups, Inpatient, and BP." },
    { target: "search-results", title: "Search Results",      body: "Results are grouped by type. Click the 'History' button next to any result to jump to that employee's full health record." },
  ],
};

function getTourSteps(pathname) {
  if (pathname.startsWith("/employees/")) return TOURS["/employees/:id"];
  return TOURS[pathname] ?? null;
}

// ─── Spotlight overlay ────────────────────────────────────────────────────────
function TourOverlay({ steps, onClose }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const timerRef = useRef(null);

  const step = steps[idx];
  const PAD = 10;

  // Find + scroll to target element
  useEffect(() => {
    clearTimeout(timerRef.current);

    const el = step?.target
      ? document.querySelector(`[data-tour="${step.target}"]`)
      : null;

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      timerRef.current = setTimeout(() => {
        setRect(el.getBoundingClientRect());
      }, 380);
    } else {
      timerRef.current = setTimeout(() => setRect(null), 0);
    }

    return () => clearTimeout(timerRef.current);
  }, [idx, step]);

  // Recalculate on resize / scroll
  useEffect(() => {
    let frameId = 0;

    function recalc() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setVp({ w: window.innerWidth, h: window.innerHeight });
        const el = step?.target
          ? document.querySelector(`[data-tour="${step.target}"]`)
          : null;
        setRect(el ? el.getBoundingClientRect() : null);
      });
    }

    const observer = new MutationObserver(recalc);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    recalc();

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [step]);

  // Keyboard nav
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  const { w, h } = vp;

  const spot = rect
    ? { x: Math.max(0, rect.left - PAD), y: Math.max(0, rect.top - PAD), w: rect.width + PAD * 2, h: rect.height + PAD * 2 }
    : null;

  // ── Tooltip position ──
  const TW = 310;
  const TH = 170;
  const MARGIN = 14;

  let tipStyle = {};
  if (spot) {
    const below = h - (spot.y + spot.h);
    const above = spot.y;
    const right = w - (spot.x + spot.w);

    if (below >= TH + MARGIN) {
      tipStyle = {
        top: spot.y + spot.h + MARGIN,
        left: Math.min(Math.max(spot.x, 8), w - TW - 8),
      };
    } else if (above >= TH + MARGIN) {
      tipStyle = {
        top: spot.y - TH - MARGIN,
        left: Math.min(Math.max(spot.x, 8), w - TW - 8),
      };
    } else if (right >= TW + MARGIN) {
      tipStyle = {
        top: Math.max(8, spot.y + spot.h / 2 - TH / 2),
        left: spot.x + spot.w + MARGIN,
      };
    } else {
      tipStyle = {
        top: Math.max(8, spot.y + spot.h / 2 - TH / 2),
        left: Math.max(8, spot.x - TW - MARGIN),
      };
    }
  } else {
    tipStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }

  return (
    <>
      {/* SVG spotlight overlay */}
      <svg
        onClick={onClose}
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 9990, display: "block" }}
      >
        <defs>
          <mask id="tour-spot">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect x={spot.x} y={spot.y} width={spot.w} height={spot.h} rx={10} fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,.68)" mask="url(#tour-spot)" />
      </svg>

      {/* Glow ring around target */}
      {spot && (
        <div
          style={{
            position: "fixed",
            left: spot.x,
            top: spot.y,
            width: spot.w,
            height: spot.h,
            borderRadius: 12,
            border: "2.5px solid #fff",
            boxShadow: "0 0 0 3px var(--brand), 0 0 28px rgba(15,107,122,.6)",
            zIndex: 9991,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          ...tipStyle,
          width: TW,
          background: "var(--card)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          boxShadow: "0 12px 48px rgba(0,0,0,.35)",
          overflow: "hidden",
          zIndex: 9992,
        }}
      >
        {/* Colored top bar */}
        <div style={{ background: "var(--brand)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>{step.title}</div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Close tour (Esc)"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "12px 14px 14px" }}>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink-soft)", margin: "0 0 14px" }}>
            {step.body}
          </p>

          {/* Dot progress */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  width: i === idx ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  border: "none",
                  background: i === idx ? "var(--brand)" : i < idx ? "rgba(15,107,122,.35)" : "var(--line)",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all .2s",
                }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {idx + 1} / {steps.length}
            </span>
            <div style={{ display: "flex", gap: 7 }}>
              {idx > 0 && (
                <button
                  onClick={() => setIdx((i) => i - 1)}
                  style={{ padding: "6px 13px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontSize: 13 }}
                >
                  ← Back
                </button>
              )}
              <button
                onClick={() => (idx < steps.length - 1 ? setIdx((i) => i + 1) : onClose())}
                style={{ padding: "6px 13px", borderRadius: 7, border: "none", background: "var(--brand)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
              >
                {idx < steps.length - 1 ? "Next →" : "Done ✓"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* "Skip tour" label */}
      <div
        style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9993, cursor: "pointer", color: "rgba(255,255,255,.6)", fontSize: 13 }}
        onClick={onClose}
      >
        Click anywhere dark or press Esc to skip
      </div>
    </>
  );
}

// ─── Help modal (full guide) ──────────────────────────────────────────────────
const GUIDE_TOPICS = [
  { id: "dashboard",  icon: "🏠", title: "Dashboard",         steps: [{ title: "Today's Stats", body: "Shows total Inpatient, BP, Checkups, and active employees." }, { title: "Alerts", body: "Flags High BP, birthdays, open checkups, overdue follow-ups, and low stock." }, { title: "Monthly Summary", body: "This month's totals broken down by Done/Open/Follow-up." }, { title: "Quick Actions", body: "Jump to any section from the bottom button row." }] },
  { id: "inpatient",  icon: "🏥", title: "In-Patient",        steps: [{ title: "Add a Visit", body: "Click Add Visit. Fill in date, patient name, department, complaint, BP, symptoms, and disposition." }, { title: "Symptom chips", body: "Click symptom chips (Fever, Cough…) to build the symptom list without typing." }, { title: "Edit / Delete", body: "Use Edit to update a record or Delete to remove it (with confirmation)." }, { title: "Upload Images", body: "Open an employee's history, find the visit row, and use the Images column to attach photos." }] },
  { id: "bp",         icon: "💓", title: "BP Monitoring",     steps: [{ title: "Add a BP Log", body: "Click Add BP Log. Enter name, BP reading (e.g. 120/80), date, time, and intervention." }, { title: "High BP highlight", body: "Readings ≥140/90 are highlighted red and create a Dashboard alert." }, { title: "Trend chart", body: "Go to an employee's history page — the BP section shows a line chart over time." }] },
  { id: "checkups",   icon: "📋", title: "Checkups",          steps: [{ title: "Add a Checkup", body: "Click Add Checkup. Select employee (auto-fills name), set status, enter symptoms and remarks." }, { title: "Bulk update", body: "Check multiple rows → bulk bar appears → choose status → click Apply." }, { title: "Print record", body: "Click Print on any row to open a formatted printable record." }, { title: "Follow-up tracking", body: "Checkups with status 'followup' from past days show as overdue on the Dashboard." }] },
  { id: "employees",  icon: "👥", title: "Employees",         steps: [{ title: "Add Employee", body: "Click Add Employee and fill in name, department, designation, and birthday." }, { title: "Open history", body: "Click any employee row to see all their BP, checkup, and inpatient records." }] },
  { id: "inventory",  icon: "💊", title: "Inventory",         steps: [{ title: "Add Item", body: "Click Add Item. Set name, category, unit, quantity, and low-stock threshold." }, { title: "Dispense", body: "Click Dispense on a row to deduct stock and log who received it." }, { title: "Low-stock alerts", body: "Items at or below threshold show ⚠ and appear on the Dashboard alerts." }] },
  { id: "reports",    icon: "📊", title: "Reports",           steps: [{ title: "Analytics tab", body: "Charts load automatically for the current month. Change month to reload." }, { title: "Daily Report", body: "Set a date range and click Load. Export to Excel with 3 sheets." }, { title: "Monthly Summary", body: "Auto-loads. Shows totals, avg BP, top symptoms, and department breakdown." }, { title: "Export", body: "Excel exports include all data in sheets. PDF button opens the print dialog." }] },
  { id: "search",     icon: "🔍", title: "Global Search",     steps: [{ title: "Search", body: "Type a name and press Enter. Results appear across Employees, Checkups, Inpatient, and BP logs." }, { title: "Navigate", body: "Click the History button next to any result to open that employee's full record." }] },
  { id: "images",     icon: "🖼️", title: "Image Upload",      steps: [{ title: "Where to upload", body: "Go to any employee's history page. Each Checkup and Inpatient row has an Images column." }, { title: "Upload", body: "Click Choose images → select files → click Upload. Images are auto-compressed before saving." }, { title: "View images", body: "Click any thumbnail to open the full-screen viewer. Use ← → or arrow keys to navigate." }] },
];

function HelpModal({ onClose }) {
  const [topicId, setTopicId] = useState(GUIDE_TOPICS[0].id);
  const [step, setStep] = useState(0);
  const topic = GUIDE_TOPICS.find((t) => t.id === topicId) ?? GUIDE_TOPICS[0];

  function selectTopic(id) {
    setTopicId(id);
    setStep(0);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, topic.steps.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, topic.steps.length]);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(900px,100%)", height: "min(620px,90vh)", background: "var(--card)", color: "var(--ink)", borderRadius: 18, boxShadow: "0 32px 80px rgba(0,0,0,.3)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--brand)", color: "#fff", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>Help Guide — JDN Clinic System</div>
            <div style={{ fontSize: 12, opacity: .82, marginTop: 2 }}>Step-by-step instructions for every feature</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.18)", border: "none", color: "#fff", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--line)", overflowY: "auto", padding: "10px 8px", background: "var(--surface-soft)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", padding: "4px 8px 8px", textTransform: "uppercase", letterSpacing: ".5px" }}>Topics</div>
            {GUIDE_TOPICS.map((t) => (
              <button key={t.id} onClick={() => selectTopic(t.id)}
                style={{ width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: topicId === t.id ? 700 : 500, background: topicId === t.id ? "var(--brand-soft)" : "transparent", color: topicId === t.id ? "var(--brand)" : "var(--ink)", marginBottom: 2 }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>{t.title}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 26 }}>{topic.icon}</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{topic.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{topic.steps.length} steps — use ← → keys to navigate</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 12, flexWrap: "wrap" }}>
                {topic.steps.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)}
                    style={{ width: i === step ? 24 : 10, height: 10, borderRadius: 5, background: i === step ? "var(--brand)" : i < step ? "var(--brand)" : "var(--line)", border: "none", cursor: "pointer", padding: 0, opacity: i < step ? .45 : 1, transition: "all .2s" }} />
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 16px" }}>
              <div key={`${topicId}-${step}`} style={{ animation: "fadeSlide .2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, flexShrink: 0 }}>{step + 1}</div>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{topic.steps[step].title}</div>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink-soft)", margin: 0, paddingLeft: 48 }}>{topic.steps[step].body}</p>
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "var(--surface-soft)" }}>
              <button onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0} className="ghost" style={{ padding: "8px 18px" }}>← Previous</button>
              <span className="muted" style={{ fontSize: 13 }}>Step <b>{step + 1}</b> of <b>{topic.steps.length}</b></span>
              {step < topic.steps.length - 1 ? (
                <button onClick={() => setStep((s) => s + 1)} className="primary" style={{ padding: "8px 18px" }}>Next →</button>
              ) : (
                <button onClick={() => { const ni = GUIDE_TOPICS.findIndex((t) => t.id === topicId) + 1; ni < GUIDE_TOPICS.length ? selectTopic(GUIDE_TOPICS[ni].id) : onClose(); }} className="primary" style={{ padding: "8px 18px", background: "var(--success)" }}>
                  {GUIDE_TOPICS.findIndex((t) => t.id === topicId) < GUIDE_TOPICS.length - 1 ? "Next topic →" : "Done ✓"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeSlide { from { opacity:0;transform:translateY(6px); } to { opacity:1;transform:translateY(0); } }`}</style>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function HelpButton() {
  const [tourActive, setTourActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  const tourSteps = getTourSteps(pathname);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function close(e) { if (!e.target.closest("[data-help-menu]")) setMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  function startTour() {
    setMenuOpen(false);
    setTourActive(true);
  }

  function openGuide() {
    setMenuOpen(false);
    setModalOpen(true);
  }

  return (
    <>
      {/* Floating button + popup menu */}
      <div data-help-menu style={{ position: "fixed", bottom: 24, right: 24, zIndex: 150, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>

        {/* Mini menu */}
        {menuOpen && (
          <div style={{ background: "var(--card)", color: "var(--ink)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.2)", border: "1px solid var(--line)", overflow: "hidden", minWidth: 190 }}>
            {tourSteps ? (
              <button onClick={startTour}
                style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", color: "var(--ink)", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: 18 }}>👆</span>
                <div>
                  <div>Page Tour</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>Highlight this page step-by-step</div>
                </div>
              </button>
            ) : (
              <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>No tour for this page yet</div>
            )}
            <button onClick={openGuide}
              style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", color: "var(--ink)", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>📖</span>
              <div>
                <div>Help Guide</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>Full feature reference</div>
              </div>
            </button>
          </div>
        )}

        {/* The ? button */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          title="Help"
          aria-label="Help"
          style={{ width: 50, height: 50, borderRadius: "50%", background: menuOpen ? "var(--brand-strong)" : "var(--brand)", color: "#fff", border: "none", cursor: "pointer", fontSize: 22, fontWeight: 900, boxShadow: "0 4px 20px rgba(15,107,122,.45)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}
        >
          {menuOpen ? "✕" : "?"}
        </button>
      </div>

      {/* Active tour overlay */}
      {tourActive && tourSteps && (
        <TourOverlay steps={tourSteps} onClose={() => setTourActive(false)} />
      )}

      {/* Help guide modal */}
      {modalOpen && <HelpModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
