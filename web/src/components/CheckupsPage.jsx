import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import DataTable from "../components/DataTable";

export default function CheckupsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  // ... keep your form state from before

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet("/api/checkups");
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onDelete(row) {
    if (!confirm("Delete this record?")) return;
    await apiDelete(`/api/checkups/${row.id}`);
    load();
  }

  async function onQuickDone(row) {
    await apiPut(`/api/checkups/${row.id}`, { status: "done" });
    load();
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      {/* your form stays here */}
      <hr style={{ margin: "18px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Recent Checkups</h3>
        <button onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
      </div>

      <DataTable
        columns={[
          { key: "request_date", header: "Date", render: (r) => String(r.request_date ?? "").slice(0,10) },
          { key: "employee_name", header: "Employee" },
          { key: "symptoms", header: "Symptoms" },
          { key: "status", header: "Status" },
        ]}
        rows={rows}
        onDelete={onDelete}
        onEdit={(row) => onQuickDone(row)} // example: quick action
      />
    </div>
  );
}