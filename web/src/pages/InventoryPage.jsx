import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete, formatApiError } from "../api";
import DataTable from "../components/DataTable";

const CATEGORIES = ["medicine", "supply"];

function DispenseModal({ item, onClose, onDispensed }) {
  const [empName, setEmpName] = useState("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await apiPost("/api/inventory/dispense", {
        inventory_id: item.id,
        employee_name: empName || null,
        quantity_dispensed: qty,
        notes: notes || null,
        record_type: "manual",
      });
      onDispensed();
      onClose();
    } catch (ex) {
      setErr(formatApiError(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, zIndex: 80 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(480px,100%)", background: "var(--card)", borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,.25)", border: "1px solid rgba(0,0,0,.10)", overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Dispense Item</div>
            <div className="muted" style={{ fontSize: 12 }}>{item.item_name} — Available: <b>{item.quantity} {item.unit}</b></div>
          </div>
          <button className="ghost" onClick={onClose} style={{ padding: "8px 12px" }}>Close</button>
        </div>
        <div style={{ padding: 16 }}>
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <label>
              Employee Name (optional)
              <input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Who is this for?" />
            </label>
            <label>
              Quantity *
              <input type="number" min={1} max={item.quantity} value={qty} onChange={(e) => setQty(Number(e.target.value))} required />
            </label>
            <label>
              Notes
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="submit" className="primary" disabled={loading}>{loading ? "Dispensing..." : "Confirm Dispense"}</button>
              <button type="button" className="ghost" onClick={onClose}>Cancel</button>
              {err && <span style={{ color: "var(--danger)", fontSize: 13 }}>{err}</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ item_name: "", category: "medicine", unit: "pcs", quantity: 0, low_stock_threshold: 10, description: "" });

  const [dispenseItem, setDispenseItem] = useState(null);
  const [logsItem, setLogsItem] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet("/api/inventory");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function loadLogs(item) {
    setLogsItem(item);
    setLogsLoading(true);
    try {
      const data = await apiGet(`/api/inventory/dispense/logs?inventory_id=${item.id}`);
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  function openAdd() {
    setMode("add");
    setEditingId(null);
    setForm({ item_name: "", category: "medicine", unit: "pcs", quantity: 0, low_stock_threshold: 10, description: "" });
    setMsg("");
    setErr("");
    setOpenModal(true);
  }

  function openEdit(row) {
    setMode("edit");
    setEditingId(row.id);
    setForm({ item_name: row.item_name, category: row.category, unit: row.unit, quantity: row.quantity, low_stock_threshold: row.low_stock_threshold, description: row.description ?? "" });
    setMsg("");
    setErr("");
    setOpenModal(true);
  }

  async function onDelete(row) {
    if (!confirm(`Delete "${row.item_name}"? This cannot be undone.`)) return;
    setErr("");
    try {
      await apiDelete(`/api/inventory/${row.id}`);
      setMsg("Deleted.");
      load();
    } catch (e) {
      setErr(formatApiError(e));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const payload = { ...form, quantity: Number(form.quantity), low_stock_threshold: Number(form.low_stock_threshold), description: form.description || null };
    try {
      if (mode === "edit") {
        await apiPut(`/api/inventory/${editingId}`, payload);
        setMsg("Updated.");
      } else {
        await apiPost("/api/inventory", payload);
        setMsg("Added.");
      }
      setOpenModal(false);
      load();
    } catch (e) {
      setErr(formatApiError(e));
    }
  }

  const columns = useMemo(() => [
    { key: "item_name", header: "Item Name" },
    { key: "category", header: "Category", render: (r) => <span className="badge blue">{r.category}</span> },
    { key: "unit", header: "Unit" },
    {
      key: "quantity",
      header: "Qty",
      render: (r) => (
        <span style={{ fontWeight: 700, color: r.is_low_stock ? "var(--danger)" : "inherit" }}>
          {r.quantity} {r.is_low_stock ? "⚠" : ""}
        </span>
      ),
      sortValue: (r) => r.quantity,
    },
    { key: "low_stock_threshold", header: "Low Stock At", sortValue: (r) => r.low_stock_threshold },
    { key: "description", header: "Description", sortable: false },
    {
      key: "__actions2",
      header: "Dispense / Log",
      sortable: false,
      render: (r) => (
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="primary" style={{ padding: "5px 10px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setDispenseItem(r); }}>Dispense</button>
          <button type="button" className="ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); loadLogs(r); }}>Logs</button>
        </div>
      ),
    },
  ], []);

  const lowCount = rows.filter((r) => r.is_low_stock).length;

  const modalBase = {
    backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, zIndex: 80 },
    panel: { width: "min(560px,100%)", background: "var(--card)", borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,.25)", border: "1px solid rgba(0,0,0,.10)", overflow: "hidden" },
  };

  return (
    <div className="container">
      <div style={{ display: "flex", gap: 12, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Inventory</h2>
          <div className="muted" style={{ fontSize: 13 }}>Track medicines and supplies. Log dispensing per visit.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button data-tour="inventory-add-btn" className="primary" onClick={openAdd}>Add Item</button>
          <button className="ghost" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
        </div>
      </div>

      <div className="hr" />

      {lowCount > 0 && (
        <div className="notice warning" style={{ marginBottom: 14 }}>
          <div>
            <div className="noticeTitle">Low stock warning</div>
            <div className="noticeText">{lowCount} item(s) are at or below the low-stock threshold. Items with ⚠ need restocking.</div>
          </div>
          <span className="badge blue">{lowCount}</span>
        </div>
      )}

      {err && <div style={{ color: "var(--danger)", marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ color: "var(--success)", marginBottom: 10 }}>{msg}</div>}

      <div data-tour="inventory-table" className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>All Items</h3>
            <div className="muted" style={{ fontSize: 13 }}>Click Dispense to deduct stock and log the transaction.</div>
          </div>
          <span className="badge blue">{rows.length} items</span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          onEdit={openEdit}
          onDelete={onDelete}
          actionsLabel="Edit / Delete"
          initialSortKey="item_name"
          initialSortDir="asc"
          stickyHeader
          defaultPageSize={20}
          pageSizeOptions={[10, 20, 50]}
          maxBodyHeight={500}
          emptyMessage="No inventory items yet. Click Add Item to start."
        />
      </div>

      {/* Add / Edit Modal */}
      {openModal && (
        <div style={modalBase.backdrop} onClick={(e) => { if (e.target === e.currentTarget) setOpenModal(false); }}>
          <div style={modalBase.panel}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{mode === "edit" ? "Edit Item" : "Add Item"}</div>
              <button className="ghost" onClick={() => setOpenModal(false)} style={{ padding: "8px 12px" }}>Close</button>
            </div>
            <div style={{ padding: 16 }}>
              <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                <label>
                  Item Name *
                  <input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} required placeholder="e.g. Paracetamol 500mg" />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    Category
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label>
                    Unit
                    <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="tablets, pcs, bottle..." />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    Quantity
                    <input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                  </label>
                  <label>
                    Low Stock Alert At
                    <input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
                  </label>
                </div>
                <label>
                  Description
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes..." />
                </label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button type="submit" className="primary">{mode === "edit" ? "Update" : "Add Item"}</button>
                  <button type="button" className="ghost" onClick={() => setOpenModal(false)}>Cancel</button>
                  {err && <span style={{ color: "var(--danger)", fontSize: 13 }}>{err}</span>}
                  {msg && <span style={{ color: "var(--success)", fontSize: 13 }}>{msg}</span>}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {dispenseItem && (
        <DispenseModal item={dispenseItem} onClose={() => setDispenseItem(null)} onDispensed={load} />
      )}

      {/* Dispensing Logs Modal */}
      {logsItem && (
        <div style={modalBase.backdrop} onClick={(e) => { if (e.target === e.currentTarget) setLogsItem(null); }}>
          <div style={{ ...modalBase.panel, width: "min(720px,100%)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Dispensing Log</div>
                <div className="muted" style={{ fontSize: 12 }}>{logsItem.item_name}</div>
              </div>
              <button className="ghost" onClick={() => setLogsItem(null)} style={{ padding: "8px 12px" }}>Close</button>
            </div>
            <div style={{ padding: 16, overflowY: "auto" }}>
              {logsLoading ? (
                <div className="muted">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="muted">No dispensing records yet.</div>
              ) : (
                <table style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Qty</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td>{String(l.dispensed_at ?? "").slice(0, 10)}</td>
                        <td>{l.employee_name ?? "-"}</td>
                        <td>{l.quantity_dispensed} {logsItem.unit}</td>
                        <td>{l.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
