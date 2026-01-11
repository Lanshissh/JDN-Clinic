import "dotenv/config";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================
   HELPERS
========================= */

function excelDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v == null || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function excelTime(v) {
  if (v == null || v === "") return null;

  if (v instanceof Date) return v.toISOString().slice(11, 19);

  const n = Number(v);
  if (!Number.isNaN(n) && n > 0 && n < 1) {
    const totalSeconds = Math.round(n * 86400);
    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  const s = String(v).trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, "0") + ":00";
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
    const [h, m, sec] = s.split(":");
    return `${h.padStart(2, "0")}:${m}:${sec}`;
  }

  return null;
}

function safeInt(v, { min = 0, max = 120 } = {}) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  if (n > 0 && n < 1) return null; // excel time fraction
  const x = Math.trunc(n);
  if (!Number.isFinite(x) || x < min || x > max) return null;
  return x;
}

function safeText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function insertBatch(table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const { error } = await supabase.from(table).insert(part);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    console.log(`Inserted ${part.length} into ${table}`);
  }
}

/* =========================
   BP IMPORT
========================= */

async function importBP(path) {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets["BP Monitoring"];
  if (!ws) throw new Error("Sheet not found: BP Monitoring");

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = data[0].map(h => String(h).trim().toLowerCase());
  const idx = (n) => header.findIndex(h => h === n.toLowerCase());

  const rows = data.slice(1).map(r => ({
    log_date: excelDate(r[idx("date")]),
    log_time: excelTime(r[idx("time")]),
    employee_name: safeText(r[idx("name")]),
    age: safeInt(r[idx("age")]),
    designation: safeText(r[idx("designation")]),
    bp_text: safeText(r[idx("bp")]),
    intervention: safeText(r[idx("intervention")]),
  })).filter(r => r.log_date);

  await insertBatch("bp_logs", rows);
}

/* =========================
   CHECKUPS IMPORT
========================= */

async function importCheckups(path) {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets["For Check-up"];
  if (!ws) throw new Error("Sheet not found: For Check-up");

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = data[0].map(h => String(h).trim().toLowerCase());
  const col = (n) => header.findIndex(h => h === n.toLowerCase());

  const rows = data.slice(1).map(r => ({
    request_date: excelDate(r[col("date")]),
    employee_name: safeText(r[col("employee name")]),
    symptoms: safeText(r[col("symptoms")]),
    remarks: safeText(r[col("remarks")]),
    status: "open",
  })).filter(r => r.request_date && r.employee_name);

  await insertBatch("checkup_requests", rows);
}

/* =========================
   INPATIENT IMPORT (TEXT SYMPTOMS)
========================= */

async function importInpatient(path) {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets["In-Patient Record"];
  if (!ws) throw new Error("Sheet not found: In-Patient Record");

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = data[2].map(h => String(h ?? "").trim());
  const headerLower = header.map(h => h.toLowerCase());
  const find = (n) => headerLower.findIndex(h => h === n.toLowerCase());

  const dateI = find("date");
  const timeI = find("time");
  const nameI = find("name");
  const ageI = find("age");
  const deptI = find("department");

  let ccI = find("chief complaint");
  if (ccI < 0) ccI = find(" chief complaint");

  const bpI = find("bp");
  const intI = find("intervention");
  const evalI = find("evaluation");
  const medsI = find("medication");

  const tempI = find("temp");
  const symptomStart = ccI + 1;
  const symptomEnd = tempI - 1;
  const symptomHeaders = header.slice(symptomStart, symptomEnd + 1).filter(Boolean);

  const rowsData = data.slice(3);
  const visits = [];

  for (const r of rowsData) {
    const visit_date = excelDate(r[dateI]);
    const name = safeText(r[nameI]);
    if (!visit_date || !name) continue;

    const symptomsList = [];
    for (let i = 0; i < symptomHeaders.length; i++) {
      if (r[symptomStart + i]) {
        symptomsList.push(symptomHeaders[i]);
      }
    }

    visits.push({
      visit_date,
      visit_time: excelTime(r[timeI]),
      name,
      age: safeInt(r[ageI]),
      department: safeText(r[deptI]),
      chief_complaint: safeText(r[ccI]),
      symptoms: symptomsList.join(", "), // ✅ COMBINED HERE
      bp_text: safeText(r[bpI]),
      intervention: safeText(r[intI]),
      disposition: safeText(r[evalI]),
      notes: medsI >= 0 ? safeText(r[medsI]) : null,
    });
  }

  await insertBatch("inpatient_visits", visits);
  console.log("Inpatient import done.");
}

/* =========================
   MAIN
========================= */

async function main() {
  // ⚠️ COMMENT OUT BP IF ALREADY IMPORTED
  // await importBP("../BP.xlsx");

  await importCheckups("../For check up.xlsx");
  await importInpatient("../In patient.xlsx");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});