import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { apiDelete, apiGet, apiPost, apiPut, formatApiError } from "../api";
import DataTable from "../components/DataTable";
import EmployeeSelect from "../components/EmployeeSelect";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
});

const TRAINING_STATUS_OPTIONS = [
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired Training" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive / Resigned" },
];

function parseDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameYear(a, b) {
  return a.getFullYear() === b.getFullYear();
}

function sameMonth(a, b) {
  return sameYear(a, b) && a.getMonth() === b.getMonth();
}

function formatTrainingDate(startValue, endValue) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);

  if (!start) return "";
  if (!end || startValue === endValue) return dateFmt.format(start);

  if (sameMonth(start, end)) {
    return `${monthDayFmt.format(start)} to ${end.getDate()}, ${end.getFullYear()}`;
  }

  if (sameYear(start, end)) {
    return `${monthDayFmt.format(start)} to ${dateFmt.format(end)}`;
  }

  return `${dateFmt.format(start)} to ${dateFmt.format(end)}`;
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasExpiredRemark(row) {
  return normalized(row.remarks).includes("expired");
}

function isResigned(row) {
  return normalized(row.remarks).includes("resigned");
}

function getTrainingStatus(row) {
  if (row?.training_status) return row.training_status;
  if (isResigned(row)) return "inactive";
  if (hasExpiredRemark(row)) return "expired";
  return "active";
}

function getTrainingStatusLabel(row) {
  if (row?.training_status_label) return row.training_status_label;

  const status = getTrainingStatus(row);
  if (status === "expired") return "Expired Training";
  if (status === "expiring") return "Expiring Soon";
  if (status === "inactive") return "Inactive / Resigned";
  return "Active";
}

function getAutomaticRemarks(row) {
  if (row?.automatic_remarks) return row.automatic_remarks;
  if (isResigned(row)) return row.remarks || "Inactive / Resigned";
  return getTrainingStatusLabel(row);
}

function isExpired(row) {
  return getTrainingStatus(row) === "expired";
}

function isExpiring(row) {
  return getTrainingStatus(row) === "expiring";
}

function isInactive(row) {
  return getTrainingStatus(row) === "inactive";
}

function formatDate(value) {
  const d = parseDate(value);
  return d ? dateFmt.format(d) : "";
}

function formatExpiryHint(row) {
  if (isInactive(row)) return "";

  const days = row?.days_until_expiry;
  if (days == null || Number.isNaN(Number(days))) return "";
  if (days < 0) return `${Math.abs(days)} day(s) overdue`;
  if (days === 0) return "Expires today";
  return `${days} day(s) left`;
}

function todayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function daysBetweenIso(fromDateStr, toDateStr) {
  const from = parseDate(fromDateStr);
  const to = parseDate(toDateStr);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function automaticRemarksForForm(form) {
  const existingRemark = normalized(form?.remarks);
  if (existingRemark.includes("resigned")) return "Resigned";
  if (existingRemark.includes("inactive")) return "Inactive";

  const expiryDate = form?.training_end_date || form?.training_start_date;
  const days = expiryDate ? daysBetweenIso(todayIso(), expiryDate) : null;
  if (days != null && days < 0) return "Expired Training";
  if (days != null && days <= 60) return "Expiring Soon";
  return "Active";
}

function statusBadgeStyle(row) {
  const status = getTrainingStatus(row);
  if (status === "expired") {
    return {
      color: "var(--danger)",
      borderColor: "rgba(180, 35, 24, 0.28)",
      background: "var(--danger-soft)",
    };
  }

  if (status === "expiring") {
    return {
      color: "var(--warning)",
      borderColor: "rgba(184, 110, 0, 0.28)",
      background: "var(--warning-soft)",
    };
  }

  if (status === "inactive") {
    return { color: "var(--muted)" };
  }

  return undefined;
}

function namesList(rows, limit = 4) {
  const names = rows.map((row) => row.full_name || "Unnamed").slice(0, limit);
  if (rows.length <= limit) return names.join(", ");
  return `${names.join(", ")}, and ${rows.length - limit} more`;
}

function uniqueOptions(rows, key) {
  return Array.from(
    new Set(rows.map((row) => String(row?.[key] ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function uniqueValues(values) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function statusOptionLabel(value) {
  return TRAINING_STATUS_OPTIONS.find((option) => option.value === value)?.label || value;
}

function initialForm() {
  return {
    employee_id: "",
    full_name: "",
    business_unit: "",
    training_start_date: "",
    training_end_date: "",
    remarks: "Active",
    assigned_location: "",
  };
}

export default function FirstAidersPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "");
  const [remarksFilter, setRemarksFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [openFilterModal, setOpenFilterModal] = useState(false);
  const [draftQ, setDraftQ] = useState("");
  const [draftStatusFilter, setDraftStatusFilter] = useState("");
  const [draftRemarksFilter, setDraftRemarksFilter] = useState("");
  const [draftLocationFilter, setDraftLocationFilter] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const automaticFormRemarks = automaticRemarksForForm(form);

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const data = await apiGet("/api/first-aiders");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      setErr(formatApiError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setStatusFilter(searchParams.get("status") || "");
  }, [searchParams]);

  useEffect(() => {
    const anyModalOpen = openModal || openFilterModal;
    if (!anyModalOpen) return undefined;

    function onKey(e) {
      if (e.key !== "Escape") return;
      if (openFilterModal) setOpenFilterModal(false);
      else setOpenModal(false);
    }

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openFilterModal, openModal]);

  function openAdd() {
    setMsg("");
    setErr("");
    setMode("add");
    setEditingId(null);
    setForm(initialForm());
    setOpenFilterModal(false);
    setOpenModal(true);
  }

  function openEdit(row) {
    setMsg("");
    setErr("");
    setMode("edit");
    setEditingId(row.id);
    setForm({
      full_name: row.full_name ?? "",
      employee_id: row.employee_id ?? "",
      business_unit: row.business_unit ?? "",
      training_start_date: String(row.training_start_date ?? "").slice(0, 10),
      training_end_date: String(row.training_end_date ?? "").slice(0, 10),
      remarks: row.remarks ?? "",
      assigned_location: row.assigned_location ?? "",
    });
    setOpenFilterModal(false);
    setOpenModal(true);
  }

  function closeModal() {
    setOpenModal(false);
    setMode("add");
    setEditingId(null);
    setForm(initialForm());
  }

  function openFilters() {
    setDraftQ(q);
    setDraftStatusFilter(statusFilter);
    setDraftRemarksFilter(remarksFilter);
    setDraftLocationFilter(locationFilter);
    setOpenFilterModal(true);
  }

  function clearFilterDrafts() {
    setDraftQ("");
    setDraftStatusFilter("");
    setDraftRemarksFilter("");
    setDraftLocationFilter("");
  }

  function applyFilters() {
    setQ(draftQ.trim());
    setStatusFilter(draftStatusFilter);
    setRemarksFilter(draftRemarksFilter);
    setLocationFilter(draftLocationFilter);
    setOpenFilterModal(false);
  }

  function clearFilters() {
    setQ("");
    setStatusFilter("");
    setRemarksFilter("");
    setLocationFilter("");
    clearFilterDrafts();
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    const payload = {
      full_name: form.full_name.trim(),
      business_unit: form.business_unit.trim(),
      training_start_date: form.training_start_date,
      training_end_date: form.training_end_date || null,
      remarks: automaticFormRemarks || null,
      assigned_location: form.assigned_location.trim(),
    };

    if (payload.training_end_date && payload.training_end_date < payload.training_start_date) {
      setErr("Training end date cannot be before training start date.");
      return;
    }

    try {
      if (mode === "edit") {
        if (!editingId) throw new Error("Select a first aider to update.");
        await apiPut(`/api/first-aiders/${editingId}`, payload);
        setMsg("First aider updated.");
      } else {
        await apiPost("/api/first-aiders", payload);
        setMsg("First aider added.");
      }

      closeModal();
      load();
    } catch (error) {
      setErr(formatApiError(error));
    }
  }

  async function onDelete(row) {
    if (!confirm(`Delete ${row.full_name}?`)) return;

    setErr("");
    setMsg("");

    try {
      await apiDelete(`/api/first-aiders/${row.id}`);
      setMsg("First aider deleted.");
      load();
    } catch (error) {
      setErr(formatApiError(error));
    }
  }

  const filteredRows = useMemo(() => {
    const needle = normalized(q);

    return rows
      .filter((row) => {
        if (remarksFilter && getAutomaticRemarks(row) !== remarksFilter) return false;
        if (statusFilter && getTrainingStatus(row) !== statusFilter) return false;
        if (locationFilter && row.assigned_location !== locationFilter) return false;
        if (!needle) return true;

        return [
          row.full_name,
          row.business_unit,
          row.assigned_location,
          row.remarks,
          getAutomaticRemarks(row),
          row.training_status_label,
          row.training_expiry_date,
        ].some((value) => normalized(value).includes(needle));
      })
      .map((row, index) => ({ ...row, _row_no: index + 1 }));
  }, [locationFilter, q, remarksFilter, rows, statusFilter]);

  const remarksOptions = useMemo(() => uniqueValues(rows.map(getAutomaticRemarks)), [rows]);
  const locationOptions = useMemo(() => uniqueOptions(rows, "assigned_location"), [rows]);

  const activeFilterSummary = useMemo(() => {
    const parts = [];
    if (q) parts.push(`Search: ${q}`);
    if (statusFilter) parts.push(`Status: ${statusOptionLabel(statusFilter)}`);
    if (remarksFilter) parts.push(`Remarks: ${remarksFilter}`);
    if (locationFilter) parts.push(`Location: ${locationFilter}`);
    return parts.length ? parts.join(" | ") : "None";
  }, [locationFilter, q, remarksFilter, statusFilter]);

  const counts = useMemo(() => {
    const expired = rows.filter(isExpired).length;
    const expiring = rows.filter(isExpiring).length;
    const inactive = rows.filter(isInactive).length;
    const active = rows.filter((row) => getTrainingStatus(row) === "active").length;
    return {
      total: rows.length,
      active,
      expiring,
      expired,
      inactive,
    };
  }, [rows]);

  const expiringRows = useMemo(() => rows.filter(isExpiring), [rows]);

  const columns = useMemo(
    () => [
      { key: "_row_no", header: "#", sortable: false },
      { key: "full_name", header: "Name" },
      { key: "business_unit", header: "B.U. / Company" },
      {
        key: "training_start_date",
        header: "Date of Training",
        render: (row) => formatTrainingDate(row.training_start_date, row.training_end_date),
        sortValue: (row) => row.training_start_date ?? "",
      },
      {
        key: "training_expiry_date",
        header: "Expires On",
        render: (row) => (
          <div>
            <div>{formatDate(row.training_expiry_date) || "-"}</div>
            {formatExpiryHint(row) ? (
              <div className="muted" style={{ fontSize: 12 }}>{formatExpiryHint(row)}</div>
            ) : null}
          </div>
        ),
        sortValue: (row) => row.training_expiry_date ?? "",
      },
      {
        key: "training_status",
        header: "Training Status",
        render: (row) => (
          <span className={getTrainingStatus(row) === "active" ? "badge blue" : "badge"} style={statusBadgeStyle(row)}>
            {getTrainingStatusLabel(row)}
          </span>
        ),
      },
      {
        key: "remarks",
        header: "Remarks",
        render: (row) => (
          <span
            className={getTrainingStatus(row) === "active" ? "badge blue" : "badge"}
            style={statusBadgeStyle(row)}
          >
            {getAutomaticRemarks(row)}
          </span>
        ),
      },
      { key: "assigned_location", header: "Assigned Loc" },
    ],
    []
  );

  function exportExcel() {
    const exportRows = filteredRows.map((row, index) => ({
      "#": index + 1,
      NAME: row.full_name ?? "",
      "B.U. / COMPANY": row.business_unit ?? "",
      "DATE OF TRAINING": formatTrainingDate(row.training_start_date, row.training_end_date),
      "EXPIRES ON": formatDate(row.training_expiry_date),
      "TRAINING STATUS": getTrainingStatusLabel(row),
      "EXPIRY NOTE": formatExpiryHint(row),
      REMARKS: getAutomaticRemarks(row),
      "ASSIGNED LOC": row.assigned_location ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 5 },
      { wch: 28 },
      { wch: 28 },
      { wch: 26 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "First Aiders");
    XLSX.writeFile(workbook, "first-aiders.xlsx");
  }

  const setupMissing =
    err &&
    /first_aiders|relation|does not exist|schema cache/i.test(err);

  return (
    <div className="container">
      <div style={{ display: "flex", gap: 12, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>First Aiders</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Maintain trained first aiders by company, training date, automatic remarks, and assigned location.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button data-tour="first-aiders-add-btn" type="button" className="primary" onClick={openAdd}>
            Add First Aider
          </button>
          <button type="button" className="ghost" onClick={exportExcel} disabled={!filteredRows.length}>
            Export Excel
          </button>
          <button type="button" className="ghost" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="hr" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div className="card statCard">
          <div className="muted" style={{ fontSize: 12 }}>Total</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{counts.total}</div>
        </div>
        <div className="card statCard">
          <div className="muted" style={{ fontSize: 12 }}>Active</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{counts.active}</div>
        </div>
        <div className="card statCard">
          <div className="muted" style={{ fontSize: 12 }}>Expiring Soon</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: counts.expiring ? "var(--warning)" : "inherit" }}>{counts.expiring}</div>
        </div>
        <div className="card statCard">
          <div className="muted" style={{ fontSize: 12 }}>Expired Training</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: counts.expired ? "var(--danger)" : "inherit" }}>{counts.expired}</div>
        </div>
        <div className="card statCard">
          <div className="muted" style={{ fontSize: 12 }}>Inactive / Resigned</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{counts.inactive}</div>
        </div>
      </div>

      {counts.expiring > 0 && (
        <div className="notice warning" style={{ marginBottom: 14 }}>
          <div>
            <div className="noticeTitle">First aider training expiring soon</div>
            <div className="noticeText">
              {counts.expiring} first aider(s) are near expiry: {namesList(expiringRows)}.
            </div>
          </div>
        </div>
      )}

      {setupMissing && (
        <div className="notice warning" style={{ marginBottom: 14 }}>
          <div>
            <div className="noticeTitle">First Aiders table is not set up yet</div>
            <div className="noticeText">
              Run <b>api/sql/create_first_aiders.sql</b> in Supabase SQL Editor to create the table and add the rows from the manual report.
            </div>
          </div>
        </div>
      )}

      {msg && <div style={{ color: "var(--success)", marginBottom: 10, fontWeight: 800 }}>{msg}</div>}
      {err && <div style={{ color: "var(--danger)", marginBottom: 10, whiteSpace: "pre-wrap" }}>{err}</div>}

      {openFilterModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="First Aiders Filters"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            zIndex: 90,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenFilterModal(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "min(760px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "grid",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Filters</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  Filter the First Aider Report by search text, status, remarks, or assigned location.
                </div>
              </div>

              <button type="button" className="ghost" onClick={() => setOpenFilterModal(false)}>
                Close
              </button>
            </div>

            <form
              data-tour="first-aiders-filters"
              onSubmit={(e) => {
                e.preventDefault();
                applyFilters();
              }}
              style={{ display: "grid", gap: 12 }}
            >
              <label>
                Search
                <input
                  value={draftQ}
                  onChange={(e) => setDraftQ(e.target.value)}
                  placeholder="Name, company, location, or remarks"
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <label>
                  Training Status
                  <select value={draftStatusFilter} onChange={(e) => setDraftStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    {TRAINING_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Remarks
                  <select value={draftRemarksFilter} onChange={(e) => setDraftRemarksFilter(e.target.value)}>
                    <option value="">All remarks</option>
                    {remarksOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Assigned Location
                  <select value={draftLocationFilter} onChange={(e) => setDraftLocationFilter(e.target.value)}>
                    <option value="">All locations</option>
                    {locationOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" className="primary">
                  Apply Filters
                </button>
                <button type="button" className="ghost" onClick={clearFilterDrafts}>
                  Reset
                </button>
                <button type="button" className="ghost" onClick={() => setOpenFilterModal(false)}>
                  Cancel
                </button>
              </div>

              <div className="muted" style={{ fontSize: 12 }}>
                Active: <b>{activeFilterSummary}</b>
              </div>
            </form>
          </div>
        </div>
      )}

      <div data-tour="first-aiders-table" className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>First Aider Report</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Current list using the same columns as the manual report.
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Active filters: <b>{activeFilterSummary}</b>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span className="badge blue">{filteredRows.length} results</span>
            <button type="button" className="ghost" onClick={openFilters}>
              Filters
            </button>
            {activeFilterSummary !== "None" ? (
              <button type="button" className="ghost" onClick={clearFilters}>
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filteredRows}
          onEdit={openEdit}
          onDelete={onDelete}
          actionsLabel="Actions"
          initialSortKey="full_name"
          initialSortDir="asc"
          stickyHeader
          defaultPageSize={15}
          pageSizeOptions={[10, 15, 25, 50, 100]}
          maxBodyHeight={520}
          emptyMessage="No first aiders found."
        />
      </div>

      {openModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={mode === "edit" ? "Edit First Aider" : "Add First Aider"}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            zIndex: 80,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="card"
            style={{
              width: "min(880px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "grid",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>{mode === "edit" ? "Edit First Aider" : "Add First Aider"}</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  Enter the details from the first aider training report.
                </div>
              </div>
              <button type="button" className="ghost" onClick={closeModal}>
                Close
              </button>
            </div>

            <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <EmployeeSelect
                  valueId={form.employee_id}
                  valueText={form.full_name}
                  onTextChange={(fullName) => {
                    setForm((current) => ({
                      ...current,
                      employee_id: "",
                      full_name: fullName,
                      business_unit: "",
                    }));
                  }}
                  onChange={(emp) => {
                    setForm((current) => ({
                      ...current,
                      employee_id: emp?.id ?? "",
                      full_name: emp?.full_name ?? "",
                      business_unit: emp?.business_unit ?? "",
                    }));
                  }}
                  label="Name *"
                  placeholder="Select employee..."
                  required
                  autoFocus
                />

                <label>
                  B.U. / Company *
                  <input
                    value={form.business_unit}
                    onChange={(e) => setForm({ ...form, business_unit: e.target.value })}
                    placeholder={form.employee_id ? "No B.U. / Company set in Employee" : "Select an employee first"}
                    readOnly={!!form.employee_id}
                    title={form.employee_id ? "Auto-filled from the selected employee" : "Select an employee to auto-fill this field"}
                    required
                  />
                  {form.employee_id && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      Auto-filled from the selected employee record.
                    </div>
                  )}
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <label>
                  Training Start *
                  <input
                    type="date"
                    value={form.training_start_date}
                    onChange={(e) => setForm({ ...form, training_start_date: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Training End
                  <input
                    type="date"
                    value={form.training_end_date}
                    onChange={(e) => setForm({ ...form, training_end_date: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label>
                  Remarks
                  <input
                    value={automaticFormRemarks}
                    readOnly
                    placeholder="Auto-calculated"
                  />
                  <div className="muted" style={{ fontSize: 12 }}>
                    Auto-calculated from the training end date.
                  </div>
                </label>

                <label>
                  Assigned Location *
                  <input
                    value={form.assigned_location}
                    onChange={(e) => setForm({ ...form, assigned_location: e.target.value })}
                    placeholder="e.g. Entec 1"
                    required
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" className="primary">
                  {mode === "edit" ? "Update First Aider" : "Save First Aider"}
                </button>
                <button type="button" className="ghost" onClick={() => setForm(initialForm())}>
                  Clear Form
                </button>
                <button type="button" className="ghost" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
