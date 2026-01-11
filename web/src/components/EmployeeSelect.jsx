import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../api";

/**
 * EmployeeSelect
 * - Loads employees once (active=true)
 * - Type to filter
 * - Click suggestion to select
 * - Returns full employee object via onChange(emp)
 */
export default function EmployeeSelect({
  valueId = "",
  onChange,
  label = "Select Employee (optional)",
  placeholder = "Type a name...",
}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [text, setText] = useState("");
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => employees.find((e) => e.id === valueId) || null,
    [employees, valueId]
  );

  async function loadEmployees() {
    setLoading(true);
    try {
      // Pull active employees (use q= to keep your API consistent)
      const data = await apiGet("/api/employees?active=true&q=");
      setEmployees(data);
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    loadEmployees();
  }, []);

  // keep input text synced when selection changes
  useEffect(() => {
    if (selected) setText(selected.full_name ?? "");
    // if cleared externally
    if (!valueId) setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueId, selected?.full_name]);

  // close dropdown when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return employees.slice(0, 12);
    const items = employees.filter((e) => {
      const name = String(e.full_name ?? "").toLowerCase();
      const code = String(e.employee_code ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
    return items.slice(0, 12);
  }, [employees, text]);

  function pick(emp) {
    setOpen(false);
    setText(emp?.full_name ?? "");
    onChange?.(emp);
  }

  function clear() {
    setOpen(false);
    setText("");
    onChange?.(null);
  }

  return (
    <label style={{ display: "grid", gap: 6 }}>
      {label}
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          value={text}
          placeholder={loading ? "Loading employees..." : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          disabled={loading}
          style={{ flex: 1 }}
        />

        <button type="button" onClick={loadEmployees} disabled={loading}>
          Refresh
        </button>

        <button type="button" onClick={clear} disabled={loading}>
          Clear
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 10,
              boxShadow: "0 6px 20px rgba(0,0,0,.08)",
              zIndex: 10,
              overflow: "hidden",
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: 10, opacity: 0.7 }}>
                No matches.
              </div>
            ) : (
              filtered.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => pick(emp)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {emp.full_name}
                    {emp.employee_code ? ` (${emp.employee_code})` : ""}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {emp.department ?? ""}
                    {emp.designation ? ` • ${emp.designation}` : ""}
                    {emp.age != null ? ` • Age ${emp.age}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selected && (
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Selected: {selected.full_name}
          {selected.department ? ` • ${selected.department}` : ""}
          {selected.designation ? ` • ${selected.designation}` : ""}
        </div>
      )}
    </label>
  );
}