import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import EmployeeSelect from "../components/EmployeeSelect";
import DataTable from "../components/DataTable";

/**
 * Symptom presets (mirror Excel columns)
 * Saved to DB as a single TEXT field: "Fever, Cough, Headache"
 */
const SYMPTOM_PRESETS = [
  "Fever",
  "Cough",
  "Colds",
  "Headache",
  "Dizziness",
  "Body pain",
  "Sore throat",
  "Nausea",
  "Vomiting",
  "Diarrhea",
  "Stomach ache",
  "Toothache",
  "Back pain",
  "Chest pain",
  "Shortness of breath",
  "Allergy / Rashes",
  "Wound / Injury",
  "Eye irritation",
  "Ear pain",
  "Others",
];

function parseSymptoms(text) {
  return new Set(
    String(text || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function symptomsToText(set) {
  return Array.from(set).join(", ");
}

function SymptomChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "primary" : "ghost"}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 13,
        border: active ? "1px solid rgba(0,47,170,.35)" : "1px solid rgba(0,0,0,.10)",
        background: active ? "var(--brand)" : "rgba(204,233,236,.40)",
        color: active ? "white" : "rgba(0,0,0,.80)",
      }}
      title="Click to toggle"
    >
      {label}
    </button>
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

export default function InpatientPage() {
  const nav = useNavigate();
  const isPhone = useMediaQuery("(max-width: 768px)");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // ✅ Modals
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openFilterModal, setOpenFilterModal] = useState(false);

  // ✅ CRUD edit state
  const [mode, setMode] = useState("add"); // "add" | "edit"
  const [editingId, setEditingId] = useState(null);

  // --- Form state ---
  const [form, setForm] = useState({
    employee_id: "",
    visit_date: new Date().toISOString().slice(0, 10),
    visit_time: "",
    name: "",
    age: "",
    department: "",
    chief_complaint: "",
    symptoms: "",
    bp_text: "",
    intervention: "",
    disposition: "",
    notes: "",
  });

  const hasEmployeeSelected = useMemo(() => !!form.employee_id, [form.employee_id]);

  // --- Symptom quick-select derived from form.symptoms ---
  const selectedSymptoms = useMemo(() => parseSymptoms(form.symptoms), [form.symptoms]);

  function toggleSymptom(symptom) {
    const set = new Set(selectedSymptoms);
    if (set.has(symptom)) set.delete(symptom);
    else set.add(symptom);
    setForm((f) => ({ ...f, symptoms: symptomsToText(set) }));
  }

  function clearSymptoms() {
    setForm((f) => ({ ...f, symptoms: "" }));
  }

  function resetFormKeepDateTime() {
    setForm((f) => ({
      ...f,
      employee_id: "",
      name: "",
      age: "",
      department: "",
      chief_complaint: "",
      symptoms: "",
      bp_text: "",
      intervention: "",
      disposition: "",
      notes: "",
    }));
  }

  function closeAddModal() {
    setOpenAddModal(false);
  }

  function closeFilterModal() {
    setOpenFilterModal(false);
  }

  // ✅ prevent background scroll while ANY modal open + close on ESC
  useEffect(() => {
    const anyOpen = openAddModal || openFilterModal;

    function onKey(e) {
      if (e.key === "Escape") {
        setOpenAddModal(false);
        setOpenFilterModal(false);
      }
    }

    if (anyOpen) {
      document.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
  }, [openAddModal, openFilterModal]);

  // --- List filters (applied) ---
  const todayIso = new Date().toISOString().slice(0, 10);
  const [fFrom, setFFrom] = useState(todayIso);
  const [fTo, setFTo] = useState(todayIso);
  const [fName, setFName] = useState("");

  // --- Draft filters (modal inputs) ---
  const [dfFrom, setDfFrom] = useState(todayIso);
  const [dfTo, setDfTo] = useState(todayIso);
  const [dfName, setDfName] = useState("");

  // --- List data ---
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsErr, setRowsErr] = useState("");

  const activeFilterSummary = useMemo(() => {
    const parts = [];
    if (fFrom) parts.push(`From: ${fFrom}`);
    if (fTo) parts.push(`To: ${fTo}`);
    if (String(fName || "").trim()) parts.push(`Name: "${String(fName).trim()}"`);
    return parts.length ? parts.join(" • ") : "No filters";
  }, [fFrom, fTo, fName]);

  function openFilters() {
    setDfFrom(fFrom);
    setDfTo(fTo);
    setDfName(fName);
    setOpenFilterModal(true);
  }

  async function loadRecent(useValues = { from: fFrom, to: fTo, name: fName }) {
    setLoadingRows(true);
    setRowsErr("");

    try {
      const qs = new URLSearchParams();
      if (useValues.from) qs.set("from", useValues.from);
      if (useValues.to) qs.set("to", useValues.to);
      if (useValues.name) qs.set("name", useValues.name);

      const data = await apiGet(`/api/inpatient?${qs.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRowsErr(String(e));
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveEmployeeAndGo(row) {
    if (row.employee_id) {
      nav(`/employees/${row.employee_id}`);
      return;
    }

    const name = String(row.name ?? "").trim();
    if (!name) return alert("No employee_id and no name to resolve history.");

    try {
      const found = await apiGet(`/api/employees?active=true&q=${encodeURIComponent(name)}`);
      if (found.length === 1) return nav(`/employees/${found[0].id}`);

      const exact = found.find(
        (x) => String(x.full_name ?? "").trim().toLowerCase() === name.toLowerCase()
      );
      if (exact) return nav(`/employees/${exact.id}`);

      alert(
        "Cannot open history: employee not matched.\n" +
          "Fix by selecting an employee when logging new visits (employee_id will be saved)."
      );
    } catch {
      alert("Cannot open history: failed to search employees.");
    }
  }

  function openAdd() {
    setMsg("");
    setErr("");
    setMode("add");
    setEditingId(null);
    setForm({
      employee_id: "",
      visit_date: new Date().toISOString().slice(0, 10),
      visit_time: "",
      name: "",
      age: "",
      department: "",
      chief_complaint: "",
      symptoms: "",
      bp_text: "",
      intervention: "",
      disposition: "",
      notes: "",
    });
    setOpenAddModal(true);
  }

  function openEdit(row) {
    setMsg("");
    setErr("");
    setMode("edit");
    setEditingId(row?.id ?? null);

    setForm({
      employee_id: row?.employee_id ?? "",
      visit_date: String(row?.visit_date ?? todayIso).slice(0, 10),
      visit_time: row?.visit_time ?? "",
      name: row?.name ?? "",
      age: row?.age ?? "",
      department: row?.department ?? "",
      chief_complaint: row?.chief_complaint ?? "",
      symptoms: row?.symptoms ?? "",
      bp_text: row?.bp_text ?? "",
      intervention: row?.intervention ?? "",
      disposition: row?.disposition ?? "",
      notes: row?.notes ?? "",
    });

    setOpenAddModal(true);
  }

  async function onDelete(row) {
    const id = row?.id;
    if (!id) return;

    const label = row?.name ? `${row.name} (${row?.visit_date ?? ""})` : "this record";
    if (!confirm(`Delete ${label}?`)) return;

    setMsg("");
    setErr("");
    try {
      await apiDelete(`/api/inpatient/${id}`);
      setMsg("Deleted!");
      loadRecent();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    const payload = {
      employee_id: form.employee_id || null,
      visit_date: form.visit_date,
      visit_time: form.visit_time || null,
      name: form.name,
      age: form.age === "" || form.age == null ? null : Number(form.age),
      department: form.department || null,
      chief_complaint: form.chief_complaint || null,
      symptoms: form.symptoms || null,
      bp_text: form.bp_text || null,
      intervention: form.intervention || null,
      disposition: form.disposition || null,
      notes: form.notes || null,
    };

    try {
      if (mode === "edit") {
        if (!editingId) throw new Error("Missing inpatient visit id for update.");
        await apiPut(`/api/inpatient/${editingId}`, payload);
        setMsg("Updated!");
      } else {
        await apiPost("/api/inpatient", payload);
        setMsg("Saved!");
      }

      resetFormKeepDateTime();
      closeAddModal();
      setMode("add");
      setEditingId(null);
      loadRecent();
    } catch (e2) {
      setErr(String(e2));
    }
  }

  // ✅ Shared responsive modal styles
  const modalBase = {
    backdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.45)",
      backdropFilter: "blur(2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
      zIndex: 80,
    },
    panel: {
      width: "min(980px, 100%)",
      maxHeight: "90vh",
      overflow: "hidden",
      background: "var(--card)",
      borderRadius: 16,
      boxShadow: "0 30px 80px rgba(0,0,0,.25)",
      border: "1px solid rgba(0,0,0,.10)",
      display: "flex",
      flexDirection: "column",
    },
    header: {
      padding: 14,
      borderBottom: "1px solid rgba(0,0,0,.08)",
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      alignItems: "center",
    },
    body: {
      padding: 14,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      overscrollBehavior: "contain",
    },
  };

  const phoneBackdropOverride = isPhone
    ? { padding: 0, alignItems: "stretch", justifyContent: "stretch" }
    : {};

  const phonePanelOverride = isPhone
    ? { width: "100%", height: "100dvh", maxHeight: "100dvh", borderRadius: 0 }
    : {};

  return (
    <div className="container">
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "end",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginBottom: 6 }}>In-Patient Visit</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Log clinic visits and review recent records. Click a row to open Employee History.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="primary" onClick={openAdd}>
            ➕ Add Visit
          </button>

          <button type="button" className="ghost" onClick={openFilters}>
            Filters
          </button>

          <button type="button" className="ghost" onClick={loadRecent} disabled={loadingRows}>
            {loadingRows ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="hr" />

      {/* ✅ Add/Edit Visit Modal */}
      {openAddModal && (
        <div
          style={{ ...modalBase.backdrop, ...phoneBackdropOverride }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={mode === "edit" ? "Edit Inpatient Visit" : "Add Inpatient Visit"}
        >
          <div style={{ ...modalBase.panel, ...phonePanelOverride }} onClick={(e) => e.stopPropagation()}>
            <div style={modalBase.header}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {mode === "edit" ? "Edit Visit" : "New Visit"}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Select an employee to auto-fill name/age/department.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge blue">Clinic Record</span>
                <button type="button" className="ghost" onClick={closeAddModal} style={{ padding: "8px 12px" }}>
                  ✕ Close
                </button>
              </div>
            </div>

            <div style={modalBase.body}>
              <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <label>
                    Date
                    <input
                      type="date"
                      value={form.visit_date}
                      onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Time
                    <input
                      type="time"
                      value={form.visit_time}
                      onChange={(e) => setForm({ ...form, visit_time: e.target.value })}
                    />
                  </label>
                </div>

                <EmployeeSelect
                  valueId={form.employee_id}
                  onChange={(emp) => {
                    setForm((f) => ({
                      ...f,
                      employee_id: emp?.id ?? "",
                      name: emp?.full_name ?? "",
                      age: emp?.age ?? "",
                      department: emp?.department ?? "",
                    }));
                  }}
                  label="Employee (optional)"
                />

                <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "2fr 1fr 2fr", gap: 12 }}>
                  <label>
                    Name *
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </label>

                  <label>
                    Age
                    <input
                      type="number"
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      disabled={hasEmployeeSelected}
                      title={hasEmployeeSelected ? "Auto-filled from Employee master list" : ""}
                    />
                  </label>

                  <label>
                    Department
                    <input
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      disabled={hasEmployeeSelected}
                      title={hasEmployeeSelected ? "Auto-filled from Employee master list" : ""}
                    />
                  </label>
                </div>

                <label>
                  Chief Complaint
                  <input
                    value={form.chief_complaint}
                    onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
                    placeholder="e.g. headache"
                  />
                </label>

                {/* Symptoms quick-select */}
                <div className="card" style={{ display: "grid", gap: 12, boxShadow: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ marginBottom: 6 }}>Symptoms (Quick Select)</h3>
                      <div className="muted" style={{ fontSize: 13 }}>
                        Tap symptoms like checkboxes. Saved as one text field (comma-separated).
                      </div>
                    </div>

                    <button type="button" className="ghost" onClick={clearSymptoms}>
                      Clear
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {SYMPTOM_PRESETS.map((s) => (
                      <SymptomChip key={s} label={s} active={selectedSymptoms.has(s)} onClick={() => toggleSymptom(s)} />
                    ))}
                  </div>

                  <label>
                    Symptoms (text)
                    <textarea
                      rows={2}
                      value={form.symptoms}
                      onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                      placeholder="You can also type here (e.g. Fever, Cough)"
                    />
                  </label>

                  <div className="muted" style={{ fontSize: 12 }}>
                    Tip: Quick-select updates the text automatically. You can still edit manually.
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <label>
                    BP (text)
                    <input value={form.bp_text} onChange={(e) => setForm({ ...form, bp_text: e.target.value })} placeholder="e.g. 120/80" />
                  </label>

                  <label>
                    Disposition
                    <input
                      value={form.disposition}
                      onChange={(e) => setForm({ ...form, disposition: e.target.value })}
                      placeholder="e.g. back to work / sick leave"
                    />
                  </label>
                </div>

                <label>
                  Intervention
                  <textarea
                    rows={2}
                    value={form.intervention}
                    onChange={(e) => setForm({ ...form, intervention: e.target.value })}
                    placeholder="e.g. gave paracetamol, advised rest"
                  />
                </label>

                <label>
                  Notes
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </label>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="submit" className="primary">
                    {mode === "edit" ? "Update Visit" : "Save Visit"}
                  </button>

                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      resetFormKeepDateTime();
                      setMsg("");
                      setErr("");
                    }}
                  >
                    Clear Form
                  </button>

                  <button type="button" className="ghost" onClick={closeAddModal}>
                    Cancel
                  </button>

                  {msg && <span style={{ color: "var(--success)" }}>{msg}</span>}
                  {err && <span style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{err}</span>}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Filters Modal */}
      {openFilterModal && (
        <div
          style={{ ...modalBase.backdrop, ...phoneBackdropOverride }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFilterModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Inpatient Filters"
        >
          <div
            style={{
              ...modalBase.panel,
              ...phonePanelOverride,
              width: isPhone ? "100%" : "min(640px, 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalBase.header}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Filters</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Set date range and name, then apply.
                </div>
              </div>

              <button type="button" className="ghost" onClick={closeFilterModal} style={{ padding: "8px 12px" }}>
                ✕ Close
              </button>
            </div>

            <div style={modalBase.body}>
              <div className="card" style={{ display: "grid", gap: 12, boxShadow: "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <label>
                    From
                    <input type="date" value={dfFrom} onChange={(e) => setDfFrom(e.target.value)} />
                  </label>

                  <label>
                    To
                    <input type="date" value={dfTo} onChange={(e) => setDfTo(e.target.value)} />
                  </label>
                </div>

                <label>
                  Name filter
                  <input value={dfName} onChange={(e) => setDfName(e.target.value)} placeholder="e.g. Juan" />
                </label>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setFFrom(dfFrom);
                      setFTo(dfTo);
                      setFName(dfName);
                      closeFilterModal();
                      loadRecent({ from: dfFrom, to: dfTo, name: dfName });
                    }}
                    disabled={loadingRows}
                  >
                    {loadingRows ? "Applying..." : "Apply Filters"}
                  </button>

                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setDfFrom(todayIso);
                      setDfTo(todayIso);
                      setDfName("");
                    }}
                    disabled={loadingRows}
                  >
                    Reset
                  </button>

                  <button type="button" className="ghost" onClick={closeFilterModal}>
                    Cancel
                  </button>
                </div>

                <div className="muted" style={{ fontSize: 12 }}>
                  Active: <b>{activeFilterSummary}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Card */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Recent Inpatient Visits</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Click headers to sort. Use Actions to Edit/Delete. Click a row to open employee history.
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Active: <b>{activeFilterSummary}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge blue">{rows.length} records</span>
            <button type="button" className="ghost" onClick={openFilters}>
              Filters
            </button>
            <button type="button" className="ghost" onClick={loadRecent} disabled={loadingRows}>
              {loadingRows ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {rowsErr && <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{rowsErr}</div>}
        {(msg || err) && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {msg && <span style={{ color: "var(--success)" }}>{msg}</span>}
            {err && <span style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{err}</span>}
          </div>
        )}

        <DataTable
          columns={[
            {
              key: "visit_date",
              header: "Date",
              render: (r) => String(r.visit_date ?? "").slice(0, 10),
              sortValue: (r) => r.visit_date ?? "",
            },
            { key: "visit_time", header: "Time" },
            { key: "name", header: "Name" },
            { key: "department", header: "Dept" },
            { key: "chief_complaint", header: "Complaint" },
            { key: "disposition", header: "Evaluation" },
          ]}
          rows={rows}
          onRowClick={resolveEmployeeAndGo}
          onEdit={openEdit}
          onDelete={onDelete}
          actionsLabel="Actions"
          initialSortKey="visit_date"
          initialSortDir="desc"
          stickyHeader
          defaultPageSize={15}
          pageSizeOptions={[10, 15, 25, 50, 100]}
          maxBodyHeight={520}
        />

        <div className="muted" style={{ fontSize: 12 }}>
          Tip: Use Actions to edit/delete. Click a row to open employee history.
        </div>
      </div>
    </div>
  );
}