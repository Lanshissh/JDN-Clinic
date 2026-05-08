import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete, formatApiError } from "../api";

function PrintModal({ row, onClose }) {
  const clinic = "JDN Clinic";
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, zIndex: 90 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(640px,100%)", background: "#fff", borderRadius: 12, boxShadow: "0 30px 80px rgba(0,0,0,.3)", overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800 }}>Print Record</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary" onClick={() => window.print()} style={{ padding: "8px 14px" }}>Print</button>
            <button className="ghost" onClick={onClose} style={{ padding: "8px 12px" }}>Close</button>
          </div>
        </div>
        <div id="printable-checkup" style={{ padding: 28, fontFamily: "Arial, sans-serif", fontSize: 14, color: "#111" }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{clinic}</div>
            <div style={{ fontSize: 13, color: "#666" }}>Checkup Request Record</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Date", String(row.request_date ?? "").slice(0, 10)],
                ["Employee Name", row.employee_name ?? "-"],
                ["Status", row.status ?? "-"],
                ["Symptoms", row.symptoms ?? "-"],
                ["Remarks", row.remarks ?? "-"],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ fontWeight: 700, padding: "6px 10px 6px 0", width: 140, verticalAlign: "top", color: "#444" }}>{label}</td>
                  <td style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 40, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "center", borderTop: "1px solid #333", paddingTop: 6, width: 180, fontSize: 12 }}>Nurse Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
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

export default function CheckupsPage() {
  const nav = useNavigate();
  const isPhone = useMediaQuery("(max-width: 768px)");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [openAddModal, setOpenAddModal] = useState(false);
  const [openFilterModal, setOpenFilterModal] = useState(false);

  const [mode, setMode] = useState("add"); // "add" | "edit"
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    employee_id: "",
    request_date: new Date().toISOString().slice(0, 10),
    employee_name: "",
    symptoms: "",
    remarks: "",
    status: "open",
  });

  // Better default: last 30 days (instead of today-only)
  const today = new Date();
  const toISO = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  const defaultFrom = toISO(daysAgo(30));
  const defaultTo = toISO(today);

  const [fFrom, setFFrom] = useState(defaultFrom);
  const [fTo, setFTo] = useState(defaultTo);
  const [fName, setFName] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [dfFrom, setDfFrom] = useState(defaultFrom);
  const [dfTo, setDfTo] = useState(defaultTo);
  const [dfName, setDfName] = useState("");
  const [dfStatus, setDfStatus] = useState("");

  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsErr, setRowsErr] = useState("");

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("done");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [printRow, setPrintRow] = useState(null);

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

  async function loadRecent(values = { from: fFrom, to: fTo, name: fName, status: fStatus }) {
    setLoadingRows(true);
    setRowsErr("");
    try {
      const qs = new URLSearchParams();
      if (values.from) qs.set("from", values.from);
      if (values.to) qs.set("to", values.to);
      if (values.name) qs.set("name", values.name);
      if (values.status) qs.set("status", values.status);

      const data = await apiGet(`/api/checkups?${qs.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRowsErr(formatApiError(e));
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openFilters() {
    setDfFrom(fFrom);
    setDfTo(fTo);
    setDfName(fName);
    setDfStatus(fStatus);
    setOpenFilterModal(true);
  }

  function openAdd() {
    setMsg("");
    setErr("");
    setMode("add");
    setEditingId(null);
    setForm({
      employee_id: "",
      request_date: new Date().toISOString().slice(0, 10),
      employee_name: "",
      symptoms: "",
      remarks: "",
      status: "open",
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
      request_date: String(row?.request_date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      employee_name: row?.employee_name ?? "",
      symptoms: row?.symptoms ?? "",
      remarks: row?.remarks ?? "",
      status: row?.status ?? "open",
    });
    setOpenAddModal(true);
  }

  async function onDelete(row) {
    const id = row?.id;
    if (!id) return;

    const label = row?.employee_name ? `${row.employee_name} (${row?.request_date ?? ""})` : "this record";
    if (!confirm(`Delete ${label}?`)) return;

    setMsg("");
    setErr("");
    try {
      await apiDelete(`/api/checkups/${id}`);
      setMsg("Deleted.");
      loadRecent();
    } catch (e) {
      setErr(formatApiError(e));
    }
  }

  async function bulkUpdate() {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    setErr("");
    try {
      await apiPost("/api/checkups/bulk-status", { ids: [...selectedIds], status: bulkStatus });
      setMsg(`Marked ${selectedIds.size} record(s) as "${bulkStatus}".`);
      setSelectedIds(new Set());
      loadRecent();
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setBulkLoading(false);
    }
  }

  async function resolveEmployeeAndGo(row) {
    if (row.employee_id) return nav(`/employees/${row.employee_id}`);

    const name = String(row.employee_name ?? "").trim();
    if (!name) {
      alert("This record is not linked to an employee yet.");
      return;
    }

    try {
      const found = await apiGet(`/api/employees?active=true&q=${encodeURIComponent(name)}`);
      if (found.length === 1) return nav(`/employees/${found[0].id}`);

      const exact = found.find(
        (x) => String(x.full_name ?? "").trim().toLowerCase() === name.toLowerCase()
      );
      if (exact) return nav(`/employees/${exact.id}`);

      alert("This checkup is not linked to an employee in the master list yet. Edit the record, select the employee, and save it.");
    } catch {
      alert("Employee history could not be opened right now. Please try again.");
    }
  }

  function statusBadge(status) {
    const s = String(status ?? "").toLowerCase();
    return <span className="badge blue">{s || "-"}</span>;
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    const payload = {
      employee_id: form.employee_id || null,
      request_date: form.request_date,
      employee_name: form.employee_name,
      symptoms: form.symptoms || null,
      remarks: form.remarks || null,
      status: form.status,
    };

    try {
      if (mode === "edit") {
        if (!editingId) throw new Error("Missing checkup id for update.");
        await apiPut(`/api/checkups/${editingId}`, payload);
        setMsg("Updated.");
      } else {
        await apiPost("/api/checkups", payload);
        setMsg("Saved.");
      }

      setForm((f) => ({
        ...f,
        employee_id: "",
        employee_name: "",
        symptoms: "",
        remarks: "",
        status: "open",
      }));

      setOpenAddModal(false);
      setMode("add");
      setEditingId(null);

      loadRecent();
    } catch (e2) {
      setErr(formatApiError(e2));
    }
  }

  const activeFilterSummary = useMemo(() => {
    const parts = [];
    if (fFrom) parts.push(`From: ${fFrom}`);
    if (fTo) parts.push(`To: ${fTo}`);
    if (String(fName || "").trim()) parts.push(`Name: "${String(fName).trim()}"`);
    if (fStatus) parts.push(`Status: ${fStatus}`);
    return parts.length ? parts.join(" | ") : "No filters";
  }, [fFrom, fTo, fName, fStatus]);

  const columns = useMemo(
    () => [
      {
        key: "__select",
        header: "",
        sortable: false,
        render: (r) => (
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={(e) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(r.id);
                else next.delete(r.id);
                return next;
              });
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        key: "request_date",
        header: "Date",
        render: (r) => String(r.request_date ?? "").slice(0, 10),
        sortValue: (r) => r.request_date ?? "",
      },
      { key: "employee_name", header: "Name" },
      { key: "symptoms", header: "Symptoms", sortable: false },
      {
        key: "status",
        header: "Status",
        render: (r) => statusBadge(r.status),
        sortValue: (r) => String(r.status ?? ""),
      },
      { key: "remarks", header: "Remarks", sortable: false },
      {
        key: "__print",
        header: "",
        sortable: false,
        render: (r) => (
          <button
            type="button"
            className="ghost"
            style={{ padding: "4px 10px", fontSize: 13 }}
            onClick={(e) => { e.stopPropagation(); setPrintRow(r); }}
          >
            Print
          </button>
        ),
      },
    ],
    [selectedIds]
  );

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
          <h2 style={{ marginBottom: 6 }}>Checkups</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Log checkups, edit/delete records, track status, and open employee history with one click.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button data-tour="checkups-add-btn" type="button" className="primary" onClick={openAdd}>
            Add Checkup
          </button>

          <button data-tour="checkups-filters" type="button" className="ghost" onClick={openFilters}>
            Filters
          </button>

          <button type="button" className="ghost" onClick={loadRecent} disabled={loadingRows}>
            {loadingRows ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="hr" />

      {/* Add/Edit Checkup Modal */}
      {openAddModal && (
        <div
          style={{ ...modalBase.backdrop, ...phoneBackdropOverride }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenAddModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={mode === "edit" ? "Edit Checkup" : "Add Checkup"}
        >
          <div style={{ ...modalBase.panel, ...phonePanelOverride }} onClick={(e) => e.stopPropagation()}>
            <div style={modalBase.header}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {mode === "edit" ? "Edit Checkup" : "New Checkup"}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Select an employee to auto-fill the name.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge blue">Clinic Record</span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setOpenAddModal(false)}
                  style={{ padding: "8px 12px" }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={modalBase.body}>
              <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isPhone ? "1fr" : "1fr 2fr 1fr",
                    gap: 12,
                  }}
                >
                  <label>
                    Date
                    <input
                      type="date"
                      value={form.request_date}
                      onChange={(e) => setForm({ ...form, request_date: e.target.value })}
                    />
                  </label>

                  <EmployeeSelect
                    valueId={form.employee_id}
                    onChange={(emp) => {
                      setForm((f) => ({
                        ...f,
                        employee_id: emp?.id ?? "",
                        employee_name: emp?.full_name ?? "",
                      }));
                    }}
                    label="Employee (optional)"
                  />

                  <label>
                    Status
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="open">open</option>
                      <option value="done">done</option>
                      <option value="followup">followup</option>
                    </select>
                  </label>
                </div>

                <label>
                  Employee Name *
                  <input
                    value={form.employee_name}
                    onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                    required
                    placeholder="Auto-filled if employee selected"
                  />
                </label>

                <label>
                  Symptoms
                  <textarea
                    rows={3}
                    value={form.symptoms}
                    onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                    placeholder="Describe symptoms..."
                  />
                </label>

                <label>
                  Remarks
                  <textarea
                    rows={2}
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    placeholder="Notes, advice, recommendations..."
                  />
                </label>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="submit" className="primary">
                    {mode === "edit" ? "Update Checkup" : "Save Checkup"}
                  </button>

                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        employee_id: "",
                        employee_name: "",
                        symptoms: "",
                        remarks: "",
                        status: "open",
                      }))
                    }
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

      {/* Filters Modal */}
      {openFilterModal && (
        <div
          style={{ ...modalBase.backdrop, ...phoneBackdropOverride }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenFilterModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Checkups Filters"
        >
          <div
            style={{
              ...modalBase.panel,
              ...phonePanelOverride,
              width: isPhone ? "100%" : "min(720px, 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalBase.header}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Filters</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Set date range, name, and status.
                </div>
              </div>

              <button
                type="button"
                className="ghost"
                onClick={() => setOpenFilterModal(false)}
                style={{ padding: "8px 12px" }}
              >
                Close
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
                  <input
                    value={dfName}
                    onChange={(e) => setDfName(e.target.value)}
                    placeholder="e.g. Juan"
                  />
                </label>

                <label>
                  Status
                  <select value={dfStatus} onChange={(e) => setDfStatus(e.target.value)}>
                    <option value="">all</option>
                    <option value="open">open</option>
                    <option value="done">done</option>
                    <option value="followup">followup</option>
                  </select>
                </label>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      // apply draft to applied
                      setFFrom(dfFrom);
                      setFTo(dfTo);
                      setFName(dfName);
                      setFStatus(dfStatus);

                      setOpenFilterModal(false);

                      // load using draft values immediately
                      loadRecent({ from: dfFrom, to: dfTo, name: dfName, status: dfStatus });
                    }}
                    disabled={loadingRows}
                  >
                    {loadingRows ? "Applying..." : "Apply Filters"}
                  </button>

                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setDfFrom(defaultFrom);
                      setDfTo(defaultTo);
                      setDfName("");
                      setDfStatus("");
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

      {/* List Card */}
      <div data-tour="checkups-table" className="card" style={{ display: "grid", gap: 12 }}>
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
            <h3 style={{ marginBottom: 6 }}>Recent Checkups</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Checkup records for the selected filter.
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

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div data-tour="checkups-bulk" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "var(--brand-soft)", borderRadius: 10, border: "1px solid rgba(15,107,122,.2)" }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selectedIds.size} selected</span>
            <span className="muted" style={{ fontSize: 13 }}>Mark as:</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={{ padding: "6px 10px" }}>
              <option value="done">done</option>
              <option value="open">open</option>
              <option value="followup">followup</option>
            </select>
            <button type="button" className="primary" onClick={bulkUpdate} disabled={bulkLoading} style={{ padding: "6px 14px" }}>
              {bulkLoading ? "Updating..." : "Apply"}
            </button>
            <button type="button" className="ghost" onClick={() => setSelectedIds(new Set())} style={{ padding: "6px 10px" }}>
              Clear Selection
            </button>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={resolveEmployeeAndGo}
          onEdit={openEdit}
          onDelete={onDelete}
          actionsLabel="Actions"
          initialSortKey="request_date"
          initialSortDir="desc"
          stickyHeader
          defaultPageSize={15}
          pageSizeOptions={[10, 15, 25, 50, 100]}
          maxBodyHeight={520}
          emptyMessage="No checkup records for this filter."
        />

        <div data-tour="checkups-bulk" className="muted" style={{ fontSize: 12 }}>
          Check rows to select, then use the bulk action bar above to update status. Click Print on any row to print a record.
        </div>
      </div>

      {printRow && <PrintModal row={printRow} onClose={() => setPrintRow(null)} />}
    </div>
  );
}
