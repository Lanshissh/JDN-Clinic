import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost, apiPut, apiDelete, formatApiError } from "../api";
import DataTable from "../components/DataTable";
import { useNavigate } from "react-router-dom";

const EMPLOYEE_TEMPLATE_HEADERS = [
  "Full Name",
  "B.U. / Company",
  "Birthday",
  "Age",
  "Department",
  "Designation",
  "Active",
];

function ageFromBirthday(value) {
  if (!value) return "";

  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

  if (today < birthdayThisYear) age -= 1;
  return age >= 0 ? age : "";
}

function normalizePersonName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getFirstAiderMarker(row) {
  const status = String(row?.training_status ?? "").toLowerCase();
  const automaticRemarks = String(row?.automatic_remarks ?? "").toLowerCase();
  const remarks = String(row?.remarks ?? "").toLowerCase();
  const daysUntilExpiry = Number(row?.days_until_expiry);
  const remarksText = `${automaticRemarks} ${remarks}`;

  if (status === "inactive" || /resigned|inactive/.test(remarksText)) return "";
  if (
    status === "expired" ||
    row?.is_training_expired ||
    (Number.isFinite(daysUntilExpiry) && daysUntilExpiry < 0) ||
    /expired/.test(remarksText)
  ) {
    return "expired";
  }

  return "current";
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getImportValue(row, keys) {
  const wanted = new Set(keys.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeHeader(key))) return value;
  }
  return "";
}

function hasImportValue(value) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "number") return Number.isFinite(value);
  return String(value ?? "").trim() !== "";
}

function isoFromParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";

  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return "";
  }

  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeYear(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return NaN;
  if (n < 100) return n >= 50 ? 1900 + n : 2000 + n;
  return n;
}

function excelDateToIso(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    const yyyy = String(parsed.y).padStart(4, "0");
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const text = String(value).trim();
  if (!text) return "";

  const ymd = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) return isoFromParts(ymd[1], ymd[2], ymd[3]);

  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = normalizeYear(numeric[3]);

    // Prefer the common Excel style from the template/example: MM/DD/YYYY.
    // If the first number cannot be a month, treat it as DD/MM/YYYY.
    if (first > 12) return isoFromParts(year, second, first);
    return isoFromParts(year, first, second);
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return isoFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function parseActive(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return true;
  if (["false", "no", "n", "0", "inactive"].includes(text)) return false;
  return true;
}

function buildEmployeeImportRow(raw, index) {
  const fullName = String(getImportValue(raw, ["full_name", "full name", "name", "employee name"]) ?? "").trim();
  const rawBirthday = getImportValue(raw, ["birthday", "birthdate", "birth date"]);
  const birthday = excelDateToIso(rawBirthday);
  const rawAge = getImportValue(raw, ["age"]);
  const ageFromFile = rawAge === "" || rawAge == null ? "" : Number(rawAge);
  const age = Number.isFinite(ageFromFile) ? ageFromFile : ageFromBirthday(birthday);
  const businessUnit = String(getImportValue(raw, ["business_unit", "business unit", "bu", "b.u.", "b.u. / company", "company"]) ?? "").trim();
  const department = String(getImportValue(raw, ["department", "dept"]) ?? "").trim();
  const designation = String(getImportValue(raw, ["designation", "position", "job title"]) ?? "").trim();
  const active = parseActive(getImportValue(raw, ["active", "status"]));
  const errors = [];

  if (!fullName) errors.push("Full Name is required");
  if (hasImportValue(rawBirthday) && !birthday) errors.push("Birthday must be a valid date");
  if (age !== "" && (!Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 130)) {
    errors.push("Age must be 0-130");
  }

  return {
    _row: index + 2,
    _errors: errors,
    full_name: fullName,
    birthday,
    age: age === "" ? "" : Number(age),
    business_unit: businessUnit,
    department,
    designation,
    active,
  };
}

function toEmployeePayload(row) {
  return {
    full_name: row.full_name,
    birthday: row.birthday || null,
    age: row.age === "" ? null : Number(row.age),
    business_unit: row.business_unit || null,
    department: row.department || null,
    designation: row.designation || null,
    active: Boolean(row.active),
  };
}

export default function EmployeesPage() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [firstAiderErr, setFirstAiderErr] = useState("");
  const [firstAiderMarkers, setFirstAiderMarkers] = useState(() => new Map());
  const [mode, setMode] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [openAddChoiceModal, setOpenAddChoiceModal] = useState(false);
  const [openFormModal, setOpenFormModal] = useState(false);
  const [openBulkModal, setOpenBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkErr, setBulkErr] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    birthday: "",
    age: "",
    business_unit: "",
    department: "",
    designation: "",
    active: true,
  });

  function resetForm() {
    setForm({
      full_name: "",
      birthday: "",
      age: "",
      business_unit: "",
      department: "",
      designation: "",
      active: true,
    });
  }

  function openAdd() {
    setMsg("");
    setErr("");
    setOpenAddChoiceModal(true);
  }

  function openSingleAdd() {
    setMsg("");
    setErr("");
    setMode("add");
    setEditingId(null);
    resetForm();
    setOpenAddChoiceModal(false);
    setOpenFormModal(true);
  }

  function openBulkAdd() {
    setMsg("");
    setErr("");
    setBulkErr("");
    setBulkMsg("");
    setBulkRows([]);
    setOpenAddChoiceModal(false);
    setOpenBulkModal(true);
  }

  function closeFormModal() {
    setOpenFormModal(false);
    setMode("add");
    setEditingId(null);
    resetForm();
    setErr("");
  }

  function closeBulkModal() {
    setOpenBulkModal(false);
    setBulkErr("");
    setBulkMsg("");
    setBulkRows([]);
    setBulkLoading(false);
  }

  async function load(search = q) {
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet(
        `/api/employees?active=true&q=${encodeURIComponent(search || "")}`
      );
      setRows(data);
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadFirstAiders() {
    setFirstAiderErr("");
    try {
      const data = await apiGet("/api/first-aiders");
      const markers = new Map();

      for (const row of Array.isArray(data) ? data : []) {
        const name = normalizePersonName(row.full_name);
        const marker = getFirstAiderMarker(row);
        if (!name || !marker) continue;

        // A current training record should win over an older expired record for the same employee.
        if (marker === "current" || !markers.has(name)) {
          markers.set(name, marker);
        }
      }

      setFirstAiderMarkers(markers);
    } catch (e) {
      setFirstAiderMarkers(new Map());
      setFirstAiderErr(formatApiError(e, "Unable to load first aider markers."));
    }
  }

  useEffect(() => {
    load("");
    loadFirstAiders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const anyModalOpen = openAddChoiceModal || openFormModal || openBulkModal;
    if (!anyModalOpen) return undefined;

    function onKey(e) {
      if (e.key !== "Escape") return;
      if (openBulkModal) closeBulkModal();
      else if (openFormModal) closeFormModal();
      else setOpenAddChoiceModal(false);
    }

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddChoiceModal, openBulkModal, openFormModal]);

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    try {
      const payload = {
        ...form,
        full_name: form.full_name?.trim() ? form.full_name.trim() : form.full_name,
        birthday: form.birthday || null,
        age: form.age === "" ? null : Number(form.age),
        business_unit: form.business_unit?.trim() ? form.business_unit.trim() : null,
        department: form.department?.trim() ? form.department.trim() : null,
        designation: form.designation?.trim() ? form.designation.trim() : null,
      };

      if (mode === "edit") {
        if (!editingId) throw new Error("Select an employee to update.");
        await apiPut(`/api/employees/${editingId}`, payload);
        setMsg("Updated.");
      } else {
        await apiPost("/api/employees", payload);
        setMsg("Saved.");
      }

      resetForm();
      setMode("add");
      setEditingId(null);
      setOpenFormModal(false);

      load(q);
    } catch (e2) {
      setErr(formatApiError(e2));
    }
  }

  function downloadEmployeeTemplate() {
    const rowsForTemplate = [
      EMPLOYEE_TEMPLATE_HEADERS,
      ["Dela Cruz, Juan A.", "JDNHO", new Date(1995, 0, 31), 29, "Production", "Operator", true],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rowsForTemplate);
    if (worksheet.C2) worksheet.C2.z = "m/d/yyyy";
    worksheet["!cols"] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 14 },
      { wch: 8 },
      { wch: 20 },
      { wch: 22 },
      { wch: 10 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "employee-import-template.xlsx");
  }

  async function parseEmployeeImport(file) {
    setBulkErr("");
    setBulkMsg("");
    setBulkRows([]);

    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) throw new Error("The selected file has no worksheet.");

      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const importRows = rawRows
        .filter((row) => Object.values(row).some((value) => String(value ?? "").trim()))
        .map(buildEmployeeImportRow);

      if (!importRows.length) throw new Error("No employee rows found in the file.");

      setBulkRows(importRows);
      const invalidCount = importRows.filter((row) => row._errors.length).length;
      setBulkMsg(
        invalidCount
          ? `${importRows.length} row(s) loaded, ${invalidCount} need fixing.`
          : `${importRows.length} row(s) ready to import.`
      );
    } catch (error) {
      setBulkErr(error?.message || "Unable to read employee import file.");
    }
  }

  async function submitBulkImport() {
    const invalidRows = bulkRows.filter((row) => row._errors.length);
    if (!bulkRows.length) {
      setBulkErr("Choose an employee import file first.");
      return;
    }
    if (invalidRows.length) {
      setBulkErr("Fix invalid rows in the file before importing.");
      return;
    }

    setBulkLoading(true);
    setBulkErr("");
    setBulkMsg("");

    try {
      const payload = {
        employees: bulkRows.map(toEmployeePayload),
      };
      const result = await apiPost("/api/employees/bulk", payload);
      setMsg(`Imported ${result?.inserted_count ?? bulkRows.length} employee(s).`);
      closeBulkModal();
      load(q);
    } catch (error) {
      setBulkErr(formatApiError(error));
    } finally {
      setBulkLoading(false);
    }
  }

  async function onDeactivate(row) {
    if (!confirm(`Deactivate ${row.full_name}?`)) return;
    try {
      await apiDelete(`/api/employees/${row.id}`);
      setMsg("Employee deactivated.");
      load(q);
    } catch (e) {
      setErr(formatApiError(e));
    }
  }

  function onQuickEdit(row) {
    setMsg("");
    setErr("");
    setMode("edit");
    setEditingId(row.id);
    setForm({
      full_name: row.full_name ?? "",
      birthday: String(row.birthday ?? "").slice(0, 10),
      age: row.age ?? "",
      business_unit: row.business_unit ?? "",
      department: row.department ?? "",
      designation: row.designation ?? "",
      active: row.active ?? true,
    });
    setOpenFormModal(true);
  }

  function goHistory(row) {
    nav(`/employees/${row.id}`);
  }

  function isFirstAiderEmployee(row) {
    return firstAiderMarkers.get(normalizePersonName(row?.full_name)) === "current";
  }

  function firstAiderMarker(row) {
    return firstAiderMarkers.get(normalizePersonName(row?.full_name)) || "";
  }

  const columns = useMemo(
    () => [
      { key: "full_name", header: "Name" },
      {
        key: "birthday",
        header: "Birthday",
        render: (r) => String(r.birthday ?? "").slice(0, 10),
        sortValue: (r) => r.birthday ?? "",
      },
      { key: "age", header: "Age", sortValue: (r) => r.age ?? 999999 },
      { key: "business_unit", header: "B.U. / Company" },
      { key: "department", header: "Dept" },
      { key: "designation", header: "Designation" },
      {
        key: "_first_aider",
        header: "First Aider",
        sortable: false,
        render: (r) => {
          const marker = firstAiderMarker(r);
          if (marker === "expired") {
            return (
              <span className="badge" style={{ color: "var(--danger)", background: "var(--danger-soft)" }}>
                Expired
              </span>
            );
          }
          if (marker === "current") return <span className="badge blue">Yes</span>;
          return "";
        },
      },
      {
        key: "_history",
        header: "History",
        sortable: false,
        render: (r) => (
          <button
            type="button"
            className="ghost"
            onClick={(e) => {
              // prevent triggering row click
              e.stopPropagation();
              goHistory(r);
            }}
            style={{ padding: "6px 10px" }}
          >
            View
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firstAiderMarkers]
  );

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Employees</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Master list for auto-fill and visit history tracking.
          </div>
        </div>

        <button data-tour="employees-add-btn" type="button" className="primary" onClick={openAdd}>
          Add Employee
        </button>
      </div>

      <div className="hr" />

      {openAddChoiceModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Employee Options"
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
            if (e.target === e.currentTarget) setOpenAddChoiceModal(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "min(620px, 100%)",
              display: "grid",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Add Employee</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  Choose how you want to add employee records.
                </div>
              </div>
              <button type="button" className="ghost" onClick={() => setOpenAddChoiceModal(false)}>
                Close
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <button
                type="button"
                className="primary"
                onClick={openSingleAdd}
                style={{ minHeight: 92, textAlign: "left", display: "grid", alignContent: "center", gap: 6 }}
              >
                <span style={{ fontSize: 16 }}>Single Add</span>
                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>
                  Add one employee using the form.
                </span>
              </button>

              <button
                type="button"
                className="ghost"
                onClick={openBulkAdd}
                style={{ minHeight: 92, textAlign: "left", display: "grid", alignContent: "center", gap: 6 }}
              >
                <span style={{ fontSize: 16 }}>Bulk Add</span>
                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
                  Import many employees from Excel or CSV.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {openFormModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={mode === "edit" ? "Edit Employee" : "Add Employee"}
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
            if (e.target === e.currentTarget) closeFormModal();
          }}
        >
          <div
            className="card"
            style={{
              width: "min(920px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "grid",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>{mode === "edit" ? "Edit Employee" : "Add Employee"}</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  Keep employee details current for clinic records.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge blue">Active list</span>
                <button type="button" className="ghost" onClick={closeFormModal}>
                  Close
                </button>
              </div>
            </div>

            <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label>
                  Full Name *
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required
                    placeholder="Last, First Middle"
                    autoFocus
                  />
                </label>

                <label>
                  Age
                  <input
                    type="number"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label>
                  Birthday
                  <input
                    type="date"
                    value={form.birthday}
                    onChange={(e) => {
                      const birthday = e.target.value;
                      setForm({
                        ...form,
                        birthday,
                        age: birthday ? ageFromBirthday(birthday) : form.age,
                      });
                    }}
                  />
                </label>

                <label>
                  B.U. / Company
                  <input
                    value={form.business_unit}
                    onChange={(e) => setForm({ ...form, business_unit: e.target.value })}
                    placeholder="e.g. JDNHO"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label>
                  Department
                  <input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. Production"
                  />
                </label>

                <label>
                  Designation
                  <input
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    placeholder="e.g. Operator"
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" className="primary">
                  {mode === "edit" ? "Update Employee" : "Save Employee"}
                </button>

                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    resetForm();
                    setMsg("");
                    setErr("");
                  }}
                >
                  Clear Form
                </button>

                <button type="button" className="ghost" onClick={closeFormModal}>
                  Cancel
                </button>

                {err && <span style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{err}</span>}
              </div>
            </form>
          </div>
        </div>
      )}

      {openBulkModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bulk Add Employees"
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
            if (e.target === e.currentTarget) closeBulkModal();
          }}
        >
          <div
            className="card"
            style={{
              width: "min(980px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "grid",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Bulk Add Employees</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  Download the template, fill it in, then import the file here.
                </div>
              </div>
              <button type="button" className="ghost" onClick={closeBulkModal}>
                Close
              </button>
            </div>

            <div
              className="notice info"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
            >
              <div>
                <div className="noticeTitle">Employee import template</div>
                <div className="noticeText">
                  Required column: Full Name. Optional columns: B.U. / Company, Birthday, Age, Department, Designation, Active.
                </div>
              </div>
              <button type="button" className="primary" onClick={downloadEmployeeTemplate}>
                Download Template
              </button>
            </div>

            <label>
              Import File
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => parseEmployeeImport(e.target.files?.[0])}
              />
            </label>

            {(bulkMsg || bulkErr) && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {bulkMsg && <span style={{ color: "var(--success)", fontWeight: 800 }}>{bulkMsg}</span>}
                {bulkErr && <span style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{bulkErr}</span>}
              </div>
            )}

            {bulkRows.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>Preview</div>
                  <span className="badge blue">{bulkRows.length} rows</span>
                </div>

                <div className="tableWrap" style={{ maxHeight: 340, overflow: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Name</th>
                        <th>B.U. / Company</th>
                        <th>Birthday</th>
                        <th>Age</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th>Active</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr key={row._row}>
                          <td>{row._row}</td>
                          <td>{row.full_name}</td>
                          <td>{row.business_unit || "-"}</td>
                          <td>{row.birthday || "-"}</td>
                          <td>{row.age === "" ? "-" : row.age}</td>
                          <td>{row.department || "-"}</td>
                          <td>{row.designation || "-"}</td>
                          <td>{row.active ? "Yes" : "No"}</td>
                          <td>
                            {row._errors.length ? (
                              <span style={{ color: "var(--danger)", fontWeight: 800 }}>
                                {row._errors.join(", ")}
                              </span>
                            ) : (
                              <span style={{ color: "var(--success)", fontWeight: 800 }}>Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary"
                onClick={submitBulkImport}
                disabled={
                  bulkLoading ||
                  !bulkRows.length ||
                  bulkRows.some((row) => row._errors.length)
                }
              >
                {bulkLoading ? "Importing..." : "Import Employees"}
              </button>
              <button type="button" className="ghost" onClick={() => setBulkRows([])} disabled={bulkLoading}>
                Clear Preview
              </button>
              <button type="button" className="ghost" onClick={closeBulkModal} disabled={bulkLoading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + Table */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Employee List</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Active employee records.
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Green rows are employees with current first aider training.
            </div>
          </div>

          <form
            data-tour="employees-search"
            onSubmit={(e) => {
              e.preventDefault();
              load(q);
            }}
            style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}
          >
            <label style={{ minWidth: 280 }}>
              Search name
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Juan"
              />
            </label>

            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Loading..." : "Search"}
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() => {
                setQ("");
                load("");
              }}
              disabled={loading}
            >
              Clear
            </button>
          </form>
        </div>

        {msg && <div style={{ color: "var(--success)", fontWeight: 800 }}>{msg}</div>}
        {!openFormModal && err && (
          <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{err}</div>
        )}
        {firstAiderErr && (
          <div style={{ color: "var(--warning)", whiteSpace: "pre-wrap" }}>{firstAiderErr}</div>
        )}

        <div data-tour="employees-table">
          <DataTable
            columns={columns}
            rows={rows}
            onEdit={onQuickEdit}
            onDelete={onDeactivate}
            onRowClick={(row) => nav(`/employees/${row.id}`)}
            getRowStyle={(row) =>
              isFirstAiderEmployee(row)
                ? {
                    background: "var(--success-soft)",
                    boxShadow: "inset 4px 0 0 var(--success)",
                  }
                : undefined
            }
            getRowTitle={(row) => isFirstAiderEmployee(row) ? "First aider" : undefined}
            initialSortKey="full_name"
            initialSortDir="asc"
            stickyHeader
            defaultPageSize={15}
            pageSizeOptions={[10, 15, 25, 50, 100]}
            maxBodyHeight={520}
            emptyMessage="No active employees found."
          />
        </div>
      </div>
    </div>
  );
}
