import { supabase } from "../supabase.js";
import { parseBp } from "../utils/bpParser.js"; // parses "120/80" -> systolic/diastolic

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function startOfMonth(dateStr) {
  return dateStr.slice(0, 7) + "-01"; // YYYY-MM-01
}

function endOfMonth(dateStr) {
  // safe "end" for range queries
  return dateStr.slice(0, 7) + "-31";
}

export async function dashboardSummary(req, res) {
  const today = isoDate(new Date());
  const from7 = addDays(today, -6); // last 7 days inclusive

  const month = today.slice(0, 7); // YYYY-MM
  const monthFrom = startOfMonth(today);
  const monthTo = endOfMonth(today);

  // ---- Today totals + active employees + open checkups today
  const [
    inpatientToday,
    bpToday,
    checkupsToday,
    employeesActive,
    openCheckupsToday,
  ] = await Promise.all([
    supabase.from("inpatient_visits").select("id").eq("visit_date", today),
    // grab bp_text + systolic/diastolic if available
    supabase
      .from("bp_logs")
      .select("id,bp_text,systolic,diastolic,log_date")
      .eq("log_date", today),
    supabase.from("checkup_requests").select("id,status").eq("request_date", today),
    supabase.from("employees").select("id").eq("active", true),
    supabase
      .from("checkup_requests")
      .select("id")
      .eq("request_date", today)
      .eq("status", "open"),
  ]);

  const anyErr =
    inpatientToday.error ||
    bpToday.error ||
    checkupsToday.error ||
    employeesActive.error ||
    openCheckupsToday.error;

  if (anyErr) {
    return res.status(500).json({
      error: "Failed to load dashboard (today totals)",
      details: String(anyErr?.message ?? ""),
    });
  }

  // ---- High BP alert (today)
  // rule: High if systolic>=140 OR diastolic>=90
  const bpRows = bpToday.data ?? [];
  const highBp = bpRows.filter((r) => {
    const s = r.systolic ?? parseBp(r.bp_text).systolic;
    const d = r.diastolic ?? parseBp(r.bp_text).diastolic;
    if (s == null && d == null) return false;
    return (s != null && s >= 140) || (d != null && d >= 90);
  });

  // ---- 7-day trend data
  const [inpatient7, bp7, checkups7] = await Promise.all([
    supabase
      .from("inpatient_visits")
      .select("visit_date")
      .gte("visit_date", from7)
      .lte("visit_date", today),
    supabase
      .from("bp_logs")
      .select("log_date")
      .gte("log_date", from7)
      .lte("log_date", today),
    supabase
      .from("checkup_requests")
      .select("request_date,status")
      .gte("request_date", from7)
      .lte("request_date", today),
  ]);

  if (inpatient7.error || bp7.error || checkups7.error) {
    return res.status(500).json({
      error: "Failed to load dashboard (7-day trend)",
    });
  }

  const days = Array.from({ length: 7 }).map((_, i) => addDays(from7, i));

  const countByDate = (rows, key) => {
    const map = new Map();
    for (const r of rows) {
      const d = r[key];
      if (!d) continue;
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return days.map((d) => map.get(d) ?? 0);
  };

  const trend = {
    labels: days,
    inpatient: countByDate(inpatient7.data ?? [], "visit_date"),
    bp: countByDate(bp7.data ?? [], "log_date"),
    checkups: countByDate(checkups7.data ?? [], "request_date"),
    checkups_done: (() => {
      const doneByDate = new Map();
      for (const r of checkups7.data ?? []) {
        if (!r.request_date) continue;
        if (r.status !== "done") continue;
        doneByDate.set(r.request_date, (doneByDate.get(r.request_date) ?? 0) + 1);
      }
      return days.map((d) => doneByDate.get(d) ?? 0);
    })(),
  };

  // ---- Monthly summary (this month)
  const [mInpatient, mBp, mCheckups] = await Promise.all([
    supabase
      .from("inpatient_visits")
      .select("visit_date")
      .gte("visit_date", monthFrom)
      .lte("visit_date", monthTo),
    supabase
      .from("bp_logs")
      .select("log_date")
      .gte("log_date", monthFrom)
      .lte("log_date", monthTo),
    supabase
      .from("checkup_requests")
      .select("request_date,status")
      .gte("request_date", monthFrom)
      .lte("request_date", monthTo),
  ]);

  if (mInpatient.error || mBp.error || mCheckups.error) {
    return res.status(500).json({
      error: "Failed to load dashboard (monthly summary)",
    });
  }

  const monthly = {
    month,
    totals: {
      inpatient: (mInpatient.data ?? []).length,
      bp: (mBp.data ?? []).length,
      checkups: (mCheckups.data ?? []).length,
      checkups_done: (mCheckups.data ?? []).filter((x) => x.status === "done").length,
      checkups_open: (mCheckups.data ?? []).filter((x) => x.status === "open").length,
      checkups_followup: (mCheckups.data ?? []).filter((x) => x.status === "followup").length,
    },
  };

  // ---- Alerts
  // tweak thresholds here
  const OPEN_CHECKUPS_ALERT_THRESHOLD = 5;

  const alerts = [];
  if (highBp.length > 0) {
    alerts.push({
      type: "danger",
      title: "High BP logs today",
      message: `${highBp.length} high reading(s) detected (≥140 systolic or ≥90 diastolic).`,
      count: highBp.length,
    });
  }

  const openCount = (openCheckupsToday.data ?? []).length;
  if (openCount >= OPEN_CHECKUPS_ALERT_THRESHOLD) {
    alerts.push({
      type: "warn",
      title: "Many open checkups today",
      message: `${openCount} checkup request(s) still OPEN today.`,
      count: openCount,
    });
  }

  res.json({
    date: today,
    totals: {
      inpatient: (inpatientToday.data ?? []).length,
      bp: (bpToday.data ?? []).length,
      checkups: (checkupsToday.data ?? []).length,
      employees: (employeesActive.data ?? []).length,
      open_checkups: openCount,
      high_bp: highBp.length,
    },
    trend,
    monthly,
    alerts,
  });
}