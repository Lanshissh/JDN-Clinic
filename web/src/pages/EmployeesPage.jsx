import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete, formatApiError } from "../api";
import DataTable from "../components/DataTable";
import { useNavigate } from "react-router-dom";

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

export default function EmployeesPage() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [openFormModal, setOpenFormModal] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    birthday: "",
    age: "",
    department: "",
    designation: "",
    active: true,
  });

  function resetForm() {
    setForm({
      full_name: "",
      birthday: "",
      age: "",
      department: "",
      designation: "",
      active: true,
    });
  }

  function openAdd() {
    setMsg("");
    setErr("");
    setMode("add");
    setEditingId(null);
    resetForm();
    setOpenFormModal(true);
  }

  function closeFormModal() {
    setOpenFormModal(false);
    setMode("add");
    setEditingId(null);
    resetForm();
    setErr("");
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

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!openFormModal) return undefined;

    function onKey(e) {
      if (e.key === "Escape") closeFormModal();
    }

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFormModal]);

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
      department: row.department ?? "",
      designation: row.designation ?? "",
      active: row.active ?? true,
    });
    setOpenFormModal(true);
  }

  function goHistory(row) {
    nav(`/employees/${row.id}`);
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
      { key: "department", header: "Dept" },
      { key: "designation", header: "Designation" },
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
    []
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

      {/* Search + Table */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Employee List</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Active employee records.
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

        <div data-tour="employees-table">
          <DataTable
            columns={columns}
            rows={rows}
            onEdit={onQuickEdit}
            onDelete={onDeactivate}
            onRowClick={(row) => nav(`/employees/${row.id}`)}
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
