import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, formatApiError, getNurseToken } from "../api";
import DataTable from "../components/DataTable";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const BASE = import.meta.env.VITE_API_BASE;

function normalizeImageUrls(row) {
  const v = row?.image_urls ?? row?.images ?? row?.attachments ?? [];
  if (!Array.isArray(v)) return [];
  if (v.length === 0) return [];
  // string[] OR {url}[]
  if (typeof v[0] === "string") return v;
  if (typeof v[0] === "object" && v[0]?.url) return v.map((x) => x.url).filter(Boolean);
  return [];
}

function ImageLightbox({ urls, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex ?? 0);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % urls.length);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + urls.length) % urls.length);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, urls.length]);

  const current = urls[idx];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.85)",
        backdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Panel — stop propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: "min(90vw, 900px)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            color: "#fff",
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.75 }}>
            {idx + 1} / {urls.length}
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a
              href={current}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#fff", fontSize: 13, opacity: 0.75, textDecoration: "none" }}
            >
              Open original ↗
            </a>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,.15)",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Image */}
        <img
          src={current}
          alt={`Image ${idx + 1}`}
          style={{
            maxWidth: "min(90vw, 900px)",
            maxHeight: "75vh",
            borderRadius: 10,
            objectFit: "contain",
            boxShadow: "0 8px 40px rgba(0,0,0,.6)",
          }}
        />

        {/* Prev / Next arrows */}
        {urls.length > 1 && (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
              style={{
                background: "rgba(255,255,255,.15)",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 18px",
                cursor: "pointer",
                fontSize: 18,
              }}
              title="Previous (←)"
            >
              ←
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % urls.length)}
              style={{
                background: "rgba(255,255,255,.15)",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 18px",
                cursor: "pointer",
                fontSize: 18,
              }}
              title="Next (→)"
            >
              →
            </button>
          </div>
        )}

        {/* Strip thumbnails */}
        {urls.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {urls.map((u, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  overflow: "hidden",
                  border: i === idx ? "2px solid #fff" : "2px solid transparent",
                  padding: 0,
                  cursor: "pointer",
                  flexShrink: 0,
                  opacity: i === idx ? 1 : 0.55,
                  transition: "opacity .15s, border-color .15s",
                }}
              >
                <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function compressImage(file, maxPx = 1200, quality = 0.78) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            const name = file.name.replace(/\.[^.]+$/, ".jpg");
            resolve(new File([blob], name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function RecordImagesCell({ type, recordId, urls, onUploaded }) {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [lightboxIdx, setLightboxIdx] = useState(null);

  function onFilePick(e) {
    const picked = Array.from(e.target.files || []);
    setFileList(picked);
    setErr("");
    setSuccess("");
    // Reset input so same files can be re-picked after an error
    e.target.value = "";
  }

  async function upload() {
    if (!recordId || !fileList.length) return;
    setErr("");
    setSuccess("");
    setUploading(true);

    try {
      setProgress("Compressing…");
      const compressed = await Promise.all(fileList.map((f) => compressImage(f)));

      const totalBefore = fileList.reduce((s, f) => s + f.size, 0);
      const totalAfter = compressed.reduce((s, f) => s + f.size, 0);

      setProgress(`Uploading ${compressed.length} file(s)…`);

      const token = getNurseToken();
      const fd = new FormData();
      for (const f of compressed) fd.append("files", f);

      const res = await fetch(`${BASE}/api/${type}/${recordId}/images`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text);

      const payload = JSON.parse(text);
      const newUrls =
        payload?.image_urls || payload?.urls || payload?.images || payload?.data?.image_urls || [];

      const normalized =
        Array.isArray(newUrls) && newUrls.length
          ? typeof newUrls[0] === "string"
            ? newUrls
            : newUrls.map((x) => x?.url).filter(Boolean)
          : null;

      onUploaded?.(normalized);
      setFileList([]);
      setSuccess(`Uploaded ${compressed.length} image(s) · ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}`);
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setUploading(false);
      setProgress("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 240 }}>
      {/* Lightbox */}
      {lightboxIdx !== null && urls?.length > 0 && (
        <ImageLightbox
          urls={urls}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {/* Thumbnails */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {urls?.length ? (
          <>
            {urls.slice(0, 6).map((u, idx) => (
              <button
                key={`${u}-${idx}`}
                type="button"
                onClick={() => setLightboxIdx(idx)}
                title="View image"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,.15)",
                  display: "inline-flex",
                  flexShrink: 0,
                  boxShadow: "0 1px 3px rgba(0,0,0,.1)",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <img
                  src={u}
                  alt="attachment"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            ))}
            {urls.length > 6 && (
              <button
                type="button"
                onClick={() => setLightboxIdx(6)}
                style={{
                  fontSize: 12,
                  background: "none",
                  border: "1px solid rgba(0,0,0,.15)",
                  borderRadius: 8,
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: "var(--muted, #888)",
                }}
              >
                +{urls.length - 6} more
              </button>
            )}
          </>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>No images</span>
        )}
      </div>

      {/* Upload controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <label
          style={{
            padding: "5px 10px",
            border: "1px solid rgba(0,0,0,.18)",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            background: "var(--card, #fff)",
            whiteSpace: "nowrap",
          }}
          title="Choose images to upload"
        >
          {fileList.length ? `${fileList.length} file(s) chosen` : "Choose images"}
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={onFilePick}
            disabled={uploading}
          />
        </label>

        {fileList.length > 0 && (
          <button
            type="button"
            className="primary"
            disabled={uploading}
            onClick={upload}
            style={{ padding: "5px 12px", fontSize: 13, whiteSpace: "nowrap" }}
            title="Compress and upload"
          >
            {uploading ? progress || "Uploading…" : "Upload"}
          </button>
        )}

        {fileList.length > 0 && !uploading && (
          <button
            type="button"
            onClick={() => { setFileList([]); setErr(""); setSuccess(""); }}
            style={{
              padding: "5px 8px",
              fontSize: 12,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--muted, #888)",
            }}
            title="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {success && (
        <div style={{ color: "var(--success, #1a7a4a)", fontSize: 12 }}>{success}</div>
      )}
      {err && (
        <div style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-wrap" }}>{err}</div>
      )}
    </div>
  );
}

export default function EmployeeHistoryPage() {
  const nav = useNavigate();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [tab, setTab] = useState("all"); // all | inpatient | bp | checkups
  const [loading, setLoading] = useState(false);

  const load = useCallback(async function load() {
    setErr("");
    setLoading(true);

    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    try {
      const r = await apiGet(`/api/employees/${id}/history?${qs.toString()}`);
      setData(r);
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [from, id, to]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const employee = data?.employee;

  const headerRight = useMemo(() => {
    if (!data) return null;

    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" className="ghost" onClick={() => nav("/employees")}>
          Back to Employees
        </button>

        <button type="button" className="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        <button type="button" className="primary" onClick={() => window.print()}>
          Print
        </button>
      </div>
    );
  }, [data, loading, nav, load]);

  const tabButton = (key, label, count) => (
    <button
      type="button"
      className={tab === key ? "primary" : "ghost"}
      onClick={() => setTab(key)}
      style={{ padding: "8px 12px" }}
    >
      {label} <span style={{ opacity: 0.85 }}>({count})</span>
    </button>
  );

  // Update images in local state without refetch
  function updateRowImages(listKey, recordId, urls) {
    setData((prev) => {
      if (!prev) return prev;
      const rows = Array.isArray(prev[listKey]) ? prev[listKey] : [];
      const nextRows = rows.map((r) => {
        if (String(r.id) !== String(recordId)) return r;
        const existing = normalizeImageUrls(r);
        const merged = urls?.length ? urls : existing;
        return { ...r, image_urls: merged };
      });
      return { ...prev, [listKey]: nextRows };
    });
  }

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: "flex", gap: 14, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Employee History</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Visit timeline for BP, Checkups, and Inpatient records.
          </div>
        </div>
        {headerRight}
      </div>

      <div className="hr" />

      {/* Loading + errors */}
      {!data ? (
        <div className="card" style={{ opacity: 0.85 }}>
          {loading ? "Loading history..." : "No data yet."}
          {err && <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap", marginTop: 10 }}>{err}</div>}
        </div>
      ) : (
        <>
          {/* Employee summary */}
          <div data-tour="history-summary" className="card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    background: "linear-gradient(180deg, rgba(0,47,170,.18), rgba(0,47,170,.06))",
                    border: "1px solid rgba(0,47,170,.25)",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: ".2px" }}>{employee?.full_name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {employee?.department ?? "-"}
                    {employee?.designation ? ` | ${employee.designation}` : ""}
                    {employee?.birthday ? ` | Birthday ${String(employee.birthday).slice(0, 10)}` : ""}
                    {employee?.age != null ? ` | Age ${employee.age}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                <span className="badge blue">Inpatient: {data.totals.inpatient}</span>
                <span className="badge blue">BP: {data.totals.bp}</span>
                <span className="badge blue">Checkups: {data.totals.checkups}</span>
              </div>
            </div>

            {/* Filters */}
            <div data-tour="history-filters" style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <label>
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>

              <label>
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>

              <button type="button" className="primary" onClick={load} disabled={loading}>
                {loading ? "Filtering..." : "Apply Filter"}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setTimeout(load, 0);
                }}
                disabled={loading}
              >
                Clear Dates
              </button>
            </div>

            {err && <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{err}</div>}
          </div>

          <div className="hr" />

          {/* Tabs */}
          <div data-tour="history-tabs" className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {tabButton("all", "All", data.totals.inpatient + data.totals.bp + data.totals.checkups)}
            {tabButton("inpatient", "Inpatient", data.totals.inpatient)}
            {tabButton("bp", "BP", data.totals.bp)}
            {tabButton("checkups", "Checkups", data.totals.checkups)}
          </div>

          <div className="hr" />

          {/* Inpatient */}
          {(tab === "all" || tab === "inpatient") && (
            <div data-tour="history-inpatient" className="card" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Inpatient Visits</h3>
                  <div className="muted" style={{ fontSize: 13 }}>Sorted and paginated for faster review.</div>
                </div>
                <span className="badge blue">{data.totals.inpatient} records</span>
              </div>

              <DataTable
                columns={[
                  { key: "visit_date", header: "Date", render: (r) => String(r.visit_date ?? "").slice(0, 10), sortValue: (r) => r.visit_date ?? "" },
                  { key: "visit_time", header: "Time" },
                  { key: "department", header: "Dept" },
                  { key: "chief_complaint", header: "Complaint" },
                  { key: "symptoms", header: "Symptoms", sortable: false },
                  { key: "disposition", header: "Evaluation" },
                  {
                    key: "__images",
                    header: "Images",
                    sortable: false,
                    render: (r) => (
                      <RecordImagesCell
                        type="inpatient"
                        recordId={r.id}
                        urls={normalizeImageUrls(r)}
                        onUploaded={(urls) => {
                          if (urls?.length) updateRowImages("inpatient", r.id, urls);
                          else load(); // fallback if backend returns something else
                        }}
                      />
                    ),
                  },
                ]}
                rows={data.inpatient}
                initialSortKey="visit_date"
                initialSortDir="desc"
                stickyHeader
                defaultPageSize={10}
                pageSizeOptions={[10, 15, 25, 50]}
                maxBodyHeight={420}
              />
            </div>
          )}

          {/* BP */}
          {(tab === "all" || tab === "bp") && (
            <div data-tour="history-bp" className="card" style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ marginBottom: 6 }}>BP Logs</h3>
                  <div className="muted" style={{ fontSize: 13 }}>BP records for this employee.</div>
                </div>
                <span className="badge blue">{data.totals.bp} records</span>
              </div>

              {/* BP Trend Chart */}
              {data.bp.length >= 2 && (() => {
                const chartData = [...data.bp]
                  .filter((r) => r.systolic || r.diastolic || r.bp_text)
                  .sort((a, b) => String(a.log_date).localeCompare(String(b.log_date)))
                  .map((r) => {
                    let sys = r.systolic, dia = r.diastolic;
                    if ((!sys || !dia) && r.bp_text) {
                      const parts = r.bp_text.split("/");
                      sys = sys ?? parseInt(parts[0]);
                      dia = dia ?? parseInt(parts[1]);
                    }
                    return { date: String(r.log_date ?? "").slice(5), systolic: isNaN(sys) ? null : sys, diastolic: isNaN(dia) ? null : dia };
                  });

                return (
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.07)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis domain={[40, 200]} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v, name) => [`${v} mmHg`, name === "systolic" ? "Systolic" : "Diastolic"]} />
                        <Legend formatter={(v) => v === "systolic" ? "Systolic" : "Diastolic"} />
                        <ReferenceLine y={140} stroke="var(--danger)" strokeDasharray="4 3" label={{ value: "140", fill: "var(--danger)", fontSize: 10 }} />
                        <ReferenceLine y={90} stroke="var(--warning)" strokeDasharray="4 3" label={{ value: "90", fill: "var(--warning)", fontSize: 10 }} />
                        <Line type="monotone" dataKey="systolic" stroke="#0f6b7a" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        <Line type="monotone" dataKey="diastolic" stroke="#e07b00" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              <DataTable
                columns={[
                  { key: "log_date", header: "Date", render: (r) => String(r.log_date ?? "").slice(0, 10), sortValue: (r) => r.log_date ?? "" },
                  { key: "log_time", header: "Time" },
                  {
                    key: "bp_text", header: "BP",
                    render: (r) => {
                      const sys = r.systolic ?? parseInt(String(r.bp_text ?? "").split("/")[0]);
                      const dia = r.diastolic ?? parseInt(String(r.bp_text ?? "").split("/")[1]);
                      const high = sys >= 140 || dia >= 90;
                      return <span style={{ fontWeight: 700, color: high ? "var(--danger)" : "inherit" }}>{r.bp_text ?? `${sys ?? "-"}/${dia ?? "-"}`}{high ? " ⚠" : ""}</span>;
                    },
                  },
                  { key: "intervention", header: "Intervention", sortable: false },
                ]}
                rows={data.bp}
                initialSortKey="log_date"
                initialSortDir="desc"
                stickyHeader
                defaultPageSize={10}
                pageSizeOptions={[10, 15, 25, 50]}
                maxBodyHeight={420}
              />
            </div>
          )}

          {/* Checkups */}
          {(tab === "all" || tab === "checkups") && (
            <div data-tour="history-checkups" className="card" style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Checkups</h3>
                  <div className="muted" style={{ fontSize: 13 }}>Statuses can be sorted and reviewed quickly.</div>
                </div>
                <span className="badge blue">{data.totals.checkups} records</span>
              </div>

              <DataTable
                columns={[
                  { key: "request_date", header: "Date", render: (r) => String(r.request_date ?? "").slice(0, 10), sortValue: (r) => r.request_date ?? "" },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => <span className="badge blue">{r.status ?? ""}</span>,
                    sortValue: (r) => r.status ?? "",
                  },
                  { key: "symptoms", header: "Symptoms", sortable: false },
                  { key: "remarks", header: "Remarks", sortable: false },
                  {
                    key: "__images",
                    header: "Images",
                    sortable: false,
                    render: (r) => (
                      <RecordImagesCell
                        type="checkups"
                        recordId={r.id}
                        urls={normalizeImageUrls(r)}
                        onUploaded={(urls) => {
                          if (urls?.length) updateRowImages("checkups", r.id, urls);
                          else load();
                        }}
                      />
                    ),
                  },
                ]}
                rows={data.checkups}
                initialSortKey="request_date"
                initialSortDir="desc"
                stickyHeader
                defaultPageSize={10}
                pageSizeOptions={[10, 15, 25, 50]}
                maxBodyHeight={420}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
