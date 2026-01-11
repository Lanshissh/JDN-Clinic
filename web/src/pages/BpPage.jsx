import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import EmployeeSelect from "../components/EmployeeSelect";
import DataTable from "../components/DataTable";
import { useNavigate } from "react-router-dom";

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

export default function BpPage() {
  const nav = useNavigate();
  const isPhone = useMediaQuery("(max-width: 768px)");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // ✅ Modals
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openFilterModal, setOpenFilterModal] = useState(false);

  // ✅ Edit state
  const [mode, setMode] = useState("add"); // "add" | "edit"
  const [editingId, setEditingId] = useState(null);

  // Form
  const [form, setForm] = useState({
    employee_id: "",
    log_date: new Date().toISOString().slice(0, 10),
    log_time: "",
    employee_name: "",
    age: "",
    designation: "",
    bp_text: "",
    intervention: "",
  });

  const hasEmployeeSelected = useMemo(() => !!form.employee_id, [form.employee_id]);

  // Recent table filters (client-side)
  const todayIso = new Date().toISOString().slice(0, 10);

  // applied filters
  const [fFrom, setFFrom] = useState(todayIso);
  const [fTo, setFTo] = useState(todayIso);
  const [fName, setFName] = useState("");

  // draft filters (modal)
  const [dfFrom, setDfFrom] = useState(todayIso);
  const [dfTo, setDfTo] = useState(todayIso);
  const [dfName, setDfName] = useState("");

  const [allRows, setAllRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsErr, setRowsErr] = useState("");

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

  async function loadAll() {
    setLoadingRows(true);
    setRowsErr("");
    try {
      const data = await apiGet("/api/bp");
      setAllRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRowsErr(String(e));
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredRows = useMemo(() => {
    const from = fFrom || "0000-00-00";
    const to = fTo || "9999-12-31";
    const q = fName.trim().toLowerCase();

    return (allRows || []).filter((r) => {
      const d = String(r.log_date ?? "");
      if (d && (d < from || d > to)) return false;

      if (!q) return true;
      const name = String(r.employee_name ?? "").toLowerCase();
      return name.includes(q);
    });
  }, [allRows, fFrom, fTo, fName]);

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

  function resetFormKeepDateTime() {
    setForm((f) => ({
      ...f,
      employee_id: "",
      employee_name: "",
      age: "",
      designation: "",
      bp_text: "",
      intervention: "",
    }));
  }

  function openAdd() {
    setMsg("");
    setErr("");
    setMode("add");
    setEditingId(null);
    setForm((f) => ({
      employee_id: "",
      log_date: new Date().toISOString().slice(0, 10),
      log_time: "",
      employee_name: "",
      age: "",
      designation: "",
      bp_text: "",
      intervention: "",
    }));
    setOpenAddModal(true);
  }

  function openEdit(row) {
    setMsg("");
    setErr("");
    setMode("edit");
    setEditingId(row?.id ?? null);

    setForm({
      employee_id: row?.employee_id ?? "",
      log_date: String(row?.log_date ?? todayIso).slice(0, 10),
      log_time: row?.log_time ?? "",
      employee_name: row?.employee_name ?? "",
      age: row?.age ?? "",
      designation: row?.designation ?? "",
      bp_text: row?.bp_text ?? "",
      intervention: row?.intervention ?? "",
    });

    setOpenAddModal(true);
  }

  async function resolveEmployeeAndGo(row) {
    if (row.employee_id) return nav(`/employees/${row.employee_id}`);

    const name = String(row.employee_name ?? "").trim();
    if (!name) return alert("No employee_id and no name to resolve history.");

    try {
      const found = await apiGet(`/api/employees?active=true&q=${encodeURIComponent(name)}`);
      if (found.length === 1) return nav(`/employees/${found[0].id}`);

      const exact = found.find(
        (x) => String(x.full_name ?? "").trim().toLowerCase() === name.toLowerCase()
      );
      if (exact) return nav(`/employees/${exact.id}`);

      alert("Cannot open history: employee not matched. Add employee_id or ensure exact name in Employees list.");
    } catch {
      alert("Cannot open history: failed to search employees.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    const payload = {
      employee_id: form.employee_id || null,
      log_date: form.log_date,
      log_time: form.log_time || null,
      employee_name: form.employee_name || null,
      age: form.age === "" || form.age == null ? null : Number(form.age),
      designation: form.designation || null,
      bp_text: form.bp_text || null,
      intervention: form.intervention || null,
    };

    try {
      if (mode === "edit") {
        if (!editingId) throw new Error("Missing BP record id for update.");
        await apiPut(`/api/bp/${editingId}`, payload);
        setMsg("Updated!");
      } else {
        await apiPost("/api/bp", payload);
        setMsg("Saved!");
      }

      resetFormKeepDateTime();
      setOpenAddModal(false);
      setEditingId(null);
      setMode("add");
      loadAll();
    } catch (e2) {
      setErr(String(e2));
    }
  }

  async function onDelete(row) {
    const id = row?.id;
    if (!id) return;

    const label =
      row?.employee_name || row?.bp_text
        ? `${row?.employee_name ?? "Unknown"} (${row?.bp_text ?? "BP"})`
        : "this record";

    if (!confirm(`Delete ${label}?`)) return;

    try {
      await apiDelete(`/api/bp/${id}`);
      setMsg("Deleted!");
      loadAll();
    } catch (e) {
      setErr(String(e));
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
      {/* Page Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>BP Monitoring</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Log BP readings, edit/delete records, and open employee history in one click.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="primary" onClick={openAdd}>
            ➕ Add BP Log
          </button>

          <button type="button" className="ghost" onClick={openFilters}>
            Filters
          </button>

          <button type="button" className="ghost" onClick={loadAll} disabled={loadingRows}>
            {loadingRows ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="hr" />

      {/* ✅ Add/Edit BP Log Modal */}
      {openAddModal && (
        <div
          style={{ ...modalBase.backdrop, ...phoneBackdropOverride }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenAddModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={mode === "edit" ? "Edit BP Log" : "Add BP Log"}
        >
          <div style={{ ...modalBase.panel, ...phonePanelOverride }} onClick={(e) => e.stopPropagation()}>
            <div style={modalBase.header}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {mode === "edit" ? "Edit BP Log" : "New BP Log"}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Select an employee to auto-fill details.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge blue">Clinic Record</span>
                <button type="button" className="ghost" onClick={() => setOpenAddModal(false)} style={{ padding: "8px 12px" }}>
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
                      value={form.log_date}
                      onChange={(e) => setForm({ ...form, log_date: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Time
                    <input
                      type="time"
                      value={form.log_time}
                      onChange={(e) => setForm({ ...form, log_time: e.target.value })}
                    />
                  </label>
                </div>

                <EmployeeSelect
                  valueId={form.employee_id}
                  onChange={(emp) => {
                    setForm((f) => ({
                      ...f,
                      employee_id: emp?.id ?? "",
                      employee_name: emp?.full_name ?? "",
                      age: emp?.age ?? "",
                      designation: emp?.designation ?? "",
                    }));
                  }}
                  label="Employee (optional)"
                />

                <label>
                  Employee Name
                  <input
                    value={form.employee_name}
                    onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                    placeholder="Optional if employee selected"
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "1fr 2fr", gap: 12 }}>
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
                    Designation
                    <input
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                      disabled={hasEmployeeSelected}
                      title={hasEmployeeSelected ? "Auto-filled from Employee master list" : ""}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <label>
                    BP (text)
                    <input
                      value={form.bp_text}
                      onChange={(e) => setForm({ ...form, bp_text: e.target.value })}
                      placeholder="e.g. 120/80"
                    />
                  </label>

                  <label>
                    Intervention
                    <input
                      value={form.intervention}
                      onChange={(e) => setForm({ ...form, intervention: e.target.value })}
                      placeholder="e.g. Rest / Water / Refer"
                    />
                  </label>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="submit" className="primary">
                    {mode === "edit" ? "Update BP Log" : "Save BP Log"}
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

                  <button type="button" className="ghost" onClick={() => setOpenAddModal(false)}>
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
            if (e.target === e.currentTarget) setOpenFilterModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="BP Filters"
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
                  Filter loaded BP logs (client-side).
                </div>
              </div>

              <button type="button" className="ghost" onClick={() => setOpenFilterModal(false)} style={{ padding: "8px 12px" }}>
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
                      setOpenFilterModal(false);
                    }}
                    disabled={loadingRows}
                  >
                    Apply Filters
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

                  <button type="button" className="ghost" onClick={() => setOpenFilterModal(false)}>
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

      {/* Recent Logs */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Recent BP Logs</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Click a row to open employee history. Use actions to edit/delete.
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Active: <b>{activeFilterSummary}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge blue">{filteredRows.length} results</span>

            <button type="button" className="ghost" onClick={openFilters}>
              Filters
            </button>

            <button type="button" className="ghost" onClick={loadAll} disabled={loadingRows}>
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
              key: "log_date",
              header: "Date",
              render: (r) => String(r.log_date ?? "").slice(0, 10),
              sortValue: (r) => r.log_date ?? "",
            },
            { key: "log_time", header: "Time" },
            { key: "employee_name", header: "Name" },
            { key: "bp_text", header: "BP" },
            { key: "intervention", header: "Intervention", sortable: false },
          ]}
          rows={filteredRows}
          onRowClick={resolveEmployeeAndGo}
          onEdit={openEdit}
          onDelete={onDelete}
          actionsLabel="Actions"
          initialSortKey="log_date"
          initialSortDir="desc"
          stickyHeader
          defaultPageSize={15}
          pageSizeOptions={[10, 15, 25, 50, 100]}
          maxBodyHeight={520}
        />

        <div className="muted" style={{ fontSize: 12 }}>
          Tip: Use the Actions column to Edit/Delete. Click the row to open employee history.
        </div>
      </div>
    </div>
  );
}