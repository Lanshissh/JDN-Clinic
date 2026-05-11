import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, formatApiError } from "../api";

function ResultSection({ title, count, children }) {
  if (!count) return null;
  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ marginBottom: 0 }}>{title}</h3>
        <span className="badge blue">{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function SearchPage() {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function search(q) {
    const trimmed = q.trim();
    if (!trimmed) { setResults(null); return; }
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet(`/api/search?q=${encodeURIComponent(trimmed)}`);
      setResults(data);
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") search(query);
  }

  const total = results
    ? results.totals.employees + results.totals.checkups + results.totals.inpatient + results.totals.bp
    : 0;

  return (
    <div className="container">
      <div>
        <h2 style={{ marginBottom: 6 }}>Global Search</h2>
        <div className="muted" style={{ fontSize: 13 }}>Search by employee name across all record types.</div>
      </div>

      <div className="hr" />

      <div data-tour="search-input" style={{ display: "flex", gap: 10, maxWidth: 600 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a name and press Enter..."
          style={{ flex: 1 }}
        />
        <button className="primary" onClick={() => search(query)} disabled={loading || !query.trim()}>
          {loading ? "Searching..." : "Search"}
        </button>
        {query && (
          <button className="ghost" onClick={() => { setQuery(""); setResults(null); }}>Clear</button>
        )}
      </div>

      {err && <div style={{ color: "var(--danger)", marginTop: 12 }}>{err}</div>}

      <div data-tour="search-results" style={{ display: "grid", gap: 14, marginTop: 14 }}>
        {!results ? (
          <div className="card muted" style={{ fontSize: 13 }}>Search results will appear here.</div>
        ) : total === 0 ? (
          <div className="card muted">No results found for "{results.query}".</div>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 13 }}>
              Found <b>{total}</b> result(s) for "<b>{results.query}</b>"
            </div>

            <ResultSection title="Employees" count={results.totals.employees}>
              <table style={{ width: "100%" }}>
                <thead><tr><th>Name</th><th>B.U. / Company</th><th>Department</th><th>Designation</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {results.employees.map((r) => (
                    <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => nav(`/employees/${r.id}`)}>
                      <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                      <td>{r.business_unit ?? "-"}</td>
                      <td>{r.department ?? "-"}</td>
                      <td>{r.designation ?? "-"}</td>
                      <td><span className="badge blue">{r.active ? "active" : "inactive"}</span></td>
                      <td><button type="button" className="ghost" style={{ padding: "4px 10px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); nav(`/employees/${r.id}`); }}>History</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResultSection>

              <ResultSection title="Checkups" count={results.totals.checkups}>
                <table style={{ width: "100%" }}>
                  <thead><tr><th>Date</th><th>Name</th><th>Status</th><th>Symptoms</th><th></th></tr></thead>
                  <tbody>
                    {results.checkups.map((r) => (
                      <tr key={r.id}>
                        <td>{String(r.request_date ?? "").slice(0, 10)}</td>
                        <td>{r.employee_name}</td>
                        <td><span className="badge blue">{r.status}</span></td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.symptoms ?? "-"}</td>
                        <td>
                          {r.employee_id && (
                            <button type="button" className="ghost" style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => nav(`/employees/${r.employee_id}`)}>Employee</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResultSection>

              <ResultSection title="Inpatient Visits" count={results.totals.inpatient}>
                <table style={{ width: "100%" }}>
                  <thead><tr><th>Date</th><th>Name</th><th>Department</th><th>Complaint</th><th></th></tr></thead>
                  <tbody>
                    {results.inpatient.map((r) => (
                      <tr key={r.id}>
                        <td>{String(r.visit_date ?? "").slice(0, 10)}</td>
                        <td>{r.name}</td>
                        <td>{r.department ?? "-"}</td>
                        <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.chief_complaint ?? "-"}</td>
                        <td>
                          {r.employee_id && (
                            <button type="button" className="ghost" style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => nav(`/employees/${r.employee_id}`)}>Employee</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResultSection>

              <ResultSection title="BP Logs" count={results.totals.bp}>
                <table style={{ width: "100%" }}>
                  <thead><tr><th>Date</th><th>Name</th><th>BP</th><th></th></tr></thead>
                  <tbody>
                    {results.bp.map((r) => (
                      <tr key={r.id}>
                        <td>{String(r.log_date ?? "").slice(0, 10)}</td>
                        <td>{r.employee_name}</td>
                        <td style={{ fontWeight: 700, color: (r.systolic >= 140 || r.diastolic >= 90) ? "var(--danger)" : "inherit" }}>{r.bp_text ?? `${r.systolic ?? "-"}/${r.diastolic ?? "-"}`}</td>
                        <td>
                          {r.employee_id && (
                            <button type="button" className="ghost" style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => nav(`/employees/${r.employee_id}`)}>Employee</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResultSection>
          </>
        )}
      </div>
    </div>
  );
}
