import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import DataTable from "../components/DataTable";
import { useNavigate } from "react-router-dom";

export default function EmployeesPage() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    employee_code: "",
    full_name: "",
    age: "",
    department: "",
    designation: "",
    active: true,
  });

  async function load(search = q) {
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet(
        `/api/employees?active=true&q=${encodeURIComponent(search || "")}`
      );
      setRows(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    try {
      const payload = {
        ...form,
        employee_code: form.employee_code?.trim() ? form.employee_code.trim() : null,
        full_name: form.full_name?.trim() ? form.full_name.trim() : form.full_name,
        age: form.age === "" ? null : Number(form.age),
        department: form.department?.trim() ? form.department.trim() : null,
        designation: form.designation?.trim() ? form.designation.trim() : null,
      };

      await apiPost("/api/employees", payload);

      setMsg("Saved!");
      setForm({
        employee_code: "",
        full_name: "",
        age: "",
        department: "",
        designation: "",
        active: true,
      });

      load("");
    } catch (e2) {
      setErr(String(e2));
    }
  }

  async function onDeactivate(row) {
    if (!confirm(`Deactivate ${row.full_name}?`)) return;
    await apiDelete(`/api/employees/${row.id}`);
    load(q);
  }

  async function onQuickEdit(row) {
    const newAge = prompt("Update age (leave blank for null):", row.age ?? "");
    if (newAge === null) return;

    const newDept = prompt("Update department (leave blank for null):", row.department ?? "");
    if (newDept === null) return;

    const newDesig = prompt("Update designation (leave blank for null):", row.designation ?? "");
    if (newDesig === null) return;

    const payload = {
      age: String(newAge).trim() === "" ? null : Number(newAge),
      department: String(newDept).trim() === "" ? null : String(newDept).trim(),
      designation: String(newDesig).trim() === "" ? null : String(newDesig).trim(),
    };

    await apiPut(`/api/employees/${row.id}`, payload);
    load(q);
  }

  function goHistory(row) {
    nav(`/employees/${row.id}`);
  }

  const columns = useMemo(
    () => [
      { key: "employee_code", header: "Code" },
      { key: "full_name", header: "Name" },
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
      </div>

      <div className="hr" />

      {/* Create form */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Add Employee</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Fill in basic info. You can edit later.
            </div>
          </div>

          <span className="badge blue">Active list</span>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <label>
              Employee Code
              <input
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                placeholder="optional"
              />
            </label>

            <label>
              Full Name *
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                placeholder="Last, First Middle"
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr", gap: 12 }}>
            <label>
              Age
              <input
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
            </label>

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
              Save Employee
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() =>
                setForm({
                  employee_code: "",
                  full_name: "",
                  age: "",
                  department: "",
                  designation: "",
                  active: true,
                })
              }
            >
              Clear form
            </button>

            {msg && <span style={{ color: "var(--success)" }}>{msg}</span>}
            {err && <span style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{err}</span>}
          </div>
        </form>
      </div>

      <div className="hr" />

      {/* Search + Table */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Employee List</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Click a row to open history. Click headers to sort.
            </div>
          </div>

          <form
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
        />
      </div>
    </div>
  );
}