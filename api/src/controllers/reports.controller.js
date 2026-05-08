import { supabase } from "../supabase.js";
import { parseBp } from "../utils/bpParser.js";

export async function dailyReport(req, res) {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const [inpatient, bp, checkups] = await Promise.all([
    supabase.from("inpatient_visits").select("*").eq("visit_date", date).order("visit_time", { ascending: true }),
    supabase.from("bp_logs").select("*").eq("log_date", date).order("log_time", { ascending: true }),
    supabase.from("checkup_requests").select("*").eq("request_date", date).order("created_at", { ascending: true }),
  ]);

  if (inpatient.error) return res.status(500).json({ error: inpatient.error.message });
  if (bp.error) return res.status(500).json({ error: bp.error.message });
  if (checkups.error) return res.status(500).json({ error: checkups.error.message });

  res.json({
    date,
    totals: {
      inpatient: inpatient.data.length,
      bp: bp.data.length,
      checkups: checkups.data.length,
    },
    inpatient: inpatient.data,
    bp: bp.data,
    checkups: checkups.data,
  });
}

export async function monthlyReport(req, res) {
  const month = req.query.month; // YYYY-MM
  if (!month) return res.status(400).json({ error: "month is required (YYYY-MM)" });

  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // first day of next month

  const [inpatient, bp, checkups] = await Promise.all([
    supabase.from("inpatient_visits").select("visit_date, department, chief_complaint, symptoms").gte("visit_date", from).lt("visit_date", to),
    supabase.from("bp_logs").select("log_date, bp_text, systolic, diastolic").gte("log_date", from).lt("log_date", to),
    supabase.from("checkup_requests").select("request_date, status, symptoms").gte("request_date", from).lt("request_date", to),
  ]);

  if (inpatient.error) return res.status(500).json({ error: inpatient.error.message });
  if (bp.error) return res.status(500).json({ error: bp.error.message });
  if (checkups.error) return res.status(500).json({ error: checkups.error.message });

  // Top symptoms from checkups
  const symptomMap = new Map();
  for (const row of checkups.data ?? []) {
    if (!row.symptoms) continue;
    for (const s of row.symptoms.split(",")) {
      const sym = s.trim();
      if (sym) symptomMap.set(sym, (symptomMap.get(sym) ?? 0) + 1);
    }
  }
  const top_symptoms = [...symptomMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // BP averages
  const bpRows = bp.data ?? [];
  const parsed = bpRows
    .map((r) => ({ s: r.systolic ?? parseBp(r.bp_text).systolic, d: r.diastolic ?? parseBp(r.bp_text).diastolic }))
    .filter((x) => x.s != null && x.d != null);

  const bp_summary = {
    avg_systolic: parsed.length ? Math.round(parsed.reduce((n, x) => n + x.s, 0) / parsed.length) : null,
    avg_diastolic: parsed.length ? Math.round(parsed.reduce((n, x) => n + x.d, 0) / parsed.length) : null,
    high_bp_count: parsed.filter((x) => x.s >= 140 || x.d >= 90).length,
    total_readings: bpRows.length,
  };

  // Department breakdown from inpatient
  const deptMap = new Map();
  for (const row of inpatient.data ?? []) {
    const dept = row.department || "Unknown";
    deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
  }
  const department_breakdown = [...deptMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([department, count]) => ({ department, count }));

  res.json({
    month,
    totals: {
      inpatient: (inpatient.data ?? []).length,
      bp: bpRows.length,
      checkups: (checkups.data ?? []).length,
      checkups_done: (checkups.data ?? []).filter((x) => x.status === "done").length,
      checkups_open: (checkups.data ?? []).filter((x) => x.status === "open").length,
      checkups_followup: (checkups.data ?? []).filter((x) => x.status === "followup").length,
    },
    bp_summary,
    top_symptoms,
    department_breakdown,
  });
}

export async function analyticsReport(req, res) {
  const month = req.query.month;
  if (!month) return res.status(400).json({ error: "month is required (YYYY-MM)" });

  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const [inpatient, bp, checkups] = await Promise.all([
    supabase.from("inpatient_visits").select("visit_date, department").gte("visit_date", from).lt("visit_date", to),
    supabase.from("bp_logs").select("log_date, bp_text, systolic, diastolic").gte("log_date", from).lt("log_date", to),
    supabase.from("checkup_requests").select("request_date, status, symptoms").gte("request_date", from).lt("request_date", to),
  ]);

  if (inpatient.error) return res.status(500).json({ error: inpatient.error.message });
  if (bp.error) return res.status(500).json({ error: bp.error.message });
  if (checkups.error) return res.status(500).json({ error: checkups.error.message });

  // Build all days in the month
  const daysInMonth = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur < end) {
    daysInMonth.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Day-by-day counts
  const countByDay = (rows, key) => {
    const map = new Map();
    for (const r of rows) { const d = r[key]; if (d) map.set(d, (map.get(d) ?? 0) + 1); }
    return map;
  };
  const inpMap = countByDay(inpatient.data ?? [], "visit_date");
  const bpMap = countByDay(bp.data ?? [], "log_date");
  const chkMap = countByDay(checkups.data ?? [], "request_date");

  const daily_trend = daysInMonth.map((d) => ({
    day: d.slice(8), // day number "01".."31"
    date: d,
    inpatient: inpMap.get(d) ?? 0,
    bp: bpMap.get(d) ?? 0,
    checkups: chkMap.get(d) ?? 0,
  }));

  // BP classification
  const bpRows = bp.data ?? [];
  const bpClassified = { normal: 0, elevated: 0, high: 0, unknown: 0 };
  for (const r of bpRows) {
    const s = r.systolic ?? parseBp(r.bp_text).systolic;
    const d = r.diastolic ?? parseBp(r.bp_text).diastolic;
    if (s == null || d == null) { bpClassified.unknown++; continue; }
    if (s >= 140 || d >= 90) bpClassified.high++;
    else if (s >= 120 || d >= 80) bpClassified.elevated++;
    else bpClassified.normal++;
  }
  const bp_classification = [
    { label: "Normal (<120/80)", value: bpClassified.normal, color: "#147a4c" },
    { label: "Elevated (120-139/80-89)", value: bpClassified.elevated, color: "#b86e00" },
    { label: "High (≥140/90)", value: bpClassified.high, color: "#b42318" },
    ...(bpClassified.unknown > 0 ? [{ label: "Unknown", value: bpClassified.unknown, color: "#999" }] : []),
  ].filter((x) => x.value > 0);

  const bp_summary = {
    avg_systolic: bpRows.length ? Math.round(bpRows.map((r) => r.systolic ?? parseBp(r.bp_text).systolic ?? 0).reduce((a, b) => a + b, 0) / bpRows.length) : null,
    avg_diastolic: bpRows.length ? Math.round(bpRows.map((r) => r.diastolic ?? parseBp(r.bp_text).diastolic ?? 0).reduce((a, b) => a + b, 0) / bpRows.length) : null,
    high_count: bpClassified.high,
    total: bpRows.length,
  };

  // Top symptoms
  const symMap = new Map();
  for (const r of checkups.data ?? []) {
    if (!r.symptoms) continue;
    for (const s of r.symptoms.split(",")) {
      const sym = s.trim(); if (sym) symMap.set(sym, (symMap.get(sym) ?? 0) + 1);
    }
  }
  const top_symptoms = [...symMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

  // Department breakdown
  const deptMap = new Map();
  for (const r of inpatient.data ?? []) {
    const dept = r.department || "Unknown";
    deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
  }
  const department_breakdown = [...deptMap.entries()].sort((a, b) => b[1] - a[1]).map(([department, count]) => ({ department, count }));

  // Checkup status
  const checkup_status = [
    { label: "Done", value: (checkups.data ?? []).filter((x) => x.status === "done").length, color: "#147a4c" },
    { label: "Open", value: (checkups.data ?? []).filter((x) => x.status === "open").length, color: "#0f6b7a" },
    { label: "Follow-up", value: (checkups.data ?? []).filter((x) => x.status === "followup").length, color: "#b86e00" },
  ].filter((x) => x.value > 0);

  res.json({
    month,
    totals: {
      inpatient: (inpatient.data ?? []).length,
      bp: bpRows.length,
      checkups: (checkups.data ?? []).length,
    },
    daily_trend,
    bp_classification,
    bp_summary,
    top_symptoms,
    department_breakdown,
    checkup_status,
  });
}