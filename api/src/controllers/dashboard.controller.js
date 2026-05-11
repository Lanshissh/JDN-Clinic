import { supabase } from "../supabase.js";
import { parseBp } from "../utils/bpParser.js"; // parses "120/80" -> systolic/diastolic
import { enrichFirstAiders, FIRST_AID_EXPIRING_DAYS } from "../utils/firstAiderStatus.js";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function todayInTimeZone(timeZone = "Asia/Manila") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateStr, days) {
  // Use an explicit UTC midnight to avoid timezone shifts
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function startOfMonth(dateStr) {
  return dateStr.slice(0, 7) + "-01"; // YYYY-MM-01
}

// This avoids invalid dates like Feb-31 and handles all month lengths safely.
function startOfNextMonth(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return isoDate(next);
}

function monthDay(dateStr) {
  const value = String(dateStr ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(5, 10) : "";
}

function isMissingBirthdayColumn(error) {
  if (!error) return false;
  const text = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .map(String)
    .join(" | ");
  return /birthday/i.test(text) && /column|schema cache|does not exist/i.test(text);
}

function namesList(rows, limit = 5) {
  const names = rows.map((row) => row.full_name || "Unnamed employee");
  const shown = names.slice(0, limit).join(", ");
  if (names.length <= limit) return shown;
  return `${shown}, and ${names.length - limit} more`;
}

function supabaseErrorDetails(error) {
  if (!error) return "";

  const text = [error.message, error.details, error.hint]
    .filter(Boolean)
    .map(String)
    .join(" | ");

  if (/ENOTFOUND/i.test(text)) {
    return `Cannot resolve Supabase host. Check SUPABASE_URL in api/.env. ${text}`;
  }

  if (/fetch failed/i.test(text)) {
    return `Cannot reach Supabase. Check internet, DNS/firewall settings, and SUPABASE_URL in api/.env. ${text}`;
  }

  return text || String(error);
}

export async function dashboardSummary(req, res) {
  const today = todayInTimeZone();
  const from7 = addDays(today, -6); // last 7 days inclusive

  const month = today.slice(0, 7); // YYYY-MM
  const monthFrom = startOfMonth(today);
  const monthToExclusive = startOfNextMonth(today);

  // ---- Today totals + active employees + open checkups today
  const [
    inpatientToday,
    bpToday,
    checkupsToday,
    employeesActive,
    employeesWithBirthdays,
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
      .from("employees")
      .select("id,full_name,birthday")
      .eq("active", true)
      .not("birthday", "is", null)
      .limit(500),
    supabase
      .from("checkup_requests")
      .select("id")
      .eq("request_date", today)
      .eq("status", "open"),
  ]);

  const birthdayColumnMissing = isMissingBirthdayColumn(employeesWithBirthdays.error);

  const anyErr =
    inpatientToday.error ||
    bpToday.error ||
    checkupsToday.error ||
    employeesActive.error ||
    (!birthdayColumnMissing && employeesWithBirthdays.error) ||
    openCheckupsToday.error;

  if (anyErr) {
    return res.status(500).json({
      error: "Failed to load dashboard (today totals)",
      details: supabaseErrorDetails(anyErr),
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

  const birthdayCelebrants = birthdayColumnMissing
    ? []
    : (employeesWithBirthdays.data ?? []).filter((employee) => {
        return monthDay(employee.birthday) === today.slice(5, 10);
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
    const err = inpatient7.error || bp7.error || checkups7.error;

    return res.status(500).json({
      error: "Failed to load dashboard (7-day trend)",
      details: supabaseErrorDetails(err),
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
  // Use [monthFrom, monthToExclusive) with .lt() instead of guessing an end-of-month day.
  const [mInpatient, mBp, mCheckups] = await Promise.all([
    supabase
      .from("inpatient_visits")
      .select("visit_date")
      .gte("visit_date", monthFrom)
      .lt("visit_date", monthToExclusive),
    supabase
      .from("bp_logs")
      .select("log_date")
      .gte("log_date", monthFrom)
      .lt("log_date", monthToExclusive),
    supabase
      .from("checkup_requests")
      .select("request_date,status")
      .gte("request_date", monthFrom)
      .lt("request_date", monthToExclusive),
  ]);

  if (mInpatient.error || mBp.error || mCheckups.error) {
    // If you want to see the real DB error temporarily, uncomment:
    // console.log("MONTHLY ERRORS:", mInpatient.error, mBp.error, mCheckups.error);
    const err = mInpatient.error || mBp.error || mCheckups.error;

    return res.status(500).json({
      error: "Failed to load dashboard (monthly summary)",
      details: supabaseErrorDetails(err),
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

  // ---- All-time totals
  const [allInpatient, allBp, allCheckups] = await Promise.all([
    supabase.from("inpatient_visits").select("*", { count: "exact", head: true }),
    supabase.from("bp_logs").select("*", { count: "exact", head: true }),
    supabase.from("checkup_requests").select("*", { count: "exact", head: true }),
  ]);

  if (allInpatient.error || allBp.error || allCheckups.error) {
    const err = allInpatient.error || allBp.error || allCheckups.error;

    return res.status(500).json({
      error: "Failed to load dashboard (all-time totals)",
      details: supabaseErrorDetails(err),
    });
  }

  // ---- Follow-up overdue (status=followup, older than today)
  const followupOverdue = await supabase
    .from("checkup_requests")
    .select("id, employee_name, request_date")
    .eq("status", "followup")
    .lt("request_date", today)
    .order("request_date", { ascending: true })
    .limit(20);

  // ---- Low stock items
  const lowStockItems = await supabase
    .from("clinic_inventory")
    .select("id, item_name, quantity, low_stock_threshold, unit")
    .order("quantity");

  const lowStock = (lowStockItems.data ?? []).filter((i) => i.quantity <= i.low_stock_threshold);

  // ---- First aider training status
  const [firstAidersResult, firstAidersAllTime] = await Promise.all([
    supabase
      .from("first_aiders")
      .select("id, full_name, business_unit, training_start_date, training_end_date, remarks, assigned_location")
      .limit(500),
    supabase.from("first_aiders").select("*", { count: "exact", head: true }),
  ]);

  const firstAiders = firstAidersResult.error
    ? []
    : enrichFirstAiders(firstAidersResult.data ?? [], { today });

  const firstAidersExpired = firstAiders.filter((row) => row.is_training_expired);
  const firstAidersExpiring = firstAiders.filter((row) => row.is_training_expiring);

  // ---- Alerts
  // tweak thresholds here
  const OPEN_CHECKUPS_ALERT_THRESHOLD = 5;

  const alerts = [];
  if (highBp.length > 0) {
    alerts.push({
      type: "danger",
      title: "High BP logs today",
      message: `${highBp.length} high reading(s) detected (>=140 systolic or >=90 diastolic).`,
      count: highBp.length,
    });
  }

  if (birthdayCelebrants.length > 0) {
    alerts.push({
      type: "birthday",
      title:
        birthdayCelebrants.length === 1
          ? "Employee birthday today"
          : "Employee birthdays today",
      message:
        birthdayCelebrants.length === 1
          ? `${namesList(birthdayCelebrants)} has a birthday today.`
          : `${birthdayCelebrants.length} employees have birthdays today: ${namesList(birthdayCelebrants)}.`,
      count: birthdayCelebrants.length,
      employees: birthdayCelebrants.map((employee) => ({
        id: employee.id,
        full_name: employee.full_name,
        birthday: employee.birthday,
      })),
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

  const overdueFollowups = followupOverdue.data ?? [];
  if (overdueFollowups.length > 0) {
    alerts.push({
      type: "warn",
      title: "Overdue follow-ups",
      message: `${overdueFollowups.length} checkup(s) marked follow-up from previous days have not been resolved.`,
      count: overdueFollowups.length,
      records: overdueFollowups.slice(0, 5).map((r) => ({
        id: r.id,
        employee_name: r.employee_name,
        request_date: r.request_date,
      })),
    });
  }

  if (lowStock.length > 0) {
    alerts.push({
      type: "warn",
      title: "Low stock items",
      message: `${lowStock.length} item(s) in inventory are at or below the low-stock threshold.`,
      count: lowStock.length,
      items: lowStock.slice(0, 5).map((i) => ({
        id: i.id,
        item_name: i.item_name,
        quantity: i.quantity,
        unit: i.unit,
        low_stock_threshold: i.low_stock_threshold,
      })),
    });
  }

  if (firstAidersExpired.length > 0) {
    alerts.push({
      type: "danger",
      title: "Expired first aider training",
      message: `${firstAidersExpired.length} first aider(s) have expired training: ${namesList(firstAidersExpired)}.`,
      count: firstAidersExpired.length,
      action_label: "View First Aiders",
      action_path: "/first-aiders?status=expired",
      records: firstAidersExpired.slice(0, 5).map((row) => ({
        id: row.id,
        full_name: row.full_name,
        assigned_location: row.assigned_location,
        training_expiry_date: row.training_expiry_date,
      })),
    });
  }

  if (firstAidersExpiring.length > 0) {
    alerts.push({
      type: "warn",
      title: "First aider training expiring",
      message: `${firstAidersExpiring.length} first aider(s) expire within ${FIRST_AID_EXPIRING_DAYS} days: ${namesList(firstAidersExpiring)}.`,
      count: firstAidersExpiring.length,
      action_label: "View First Aiders",
      action_path: "/first-aiders?status=expiring",
      records: firstAidersExpiring.slice(0, 5).map((row) => ({
        id: row.id,
        full_name: row.full_name,
        assigned_location: row.assigned_location,
        training_expiry_date: row.training_expiry_date,
        days_until_expiry: row.days_until_expiry,
      })),
    });
  }

  res.json({
    date: today,
    totals: {
      inpatient: (inpatientToday.data ?? []).length,
      bp: (bpToday.data ?? []).length,
      checkups: (checkupsToday.data ?? []).length,
      employees: (employeesActive.data ?? []).length,
      birthdays_today: birthdayCelebrants.length,
      open_checkups: openCount,
      high_bp: highBp.length,
      overdue_followups: overdueFollowups.length,
      low_stock: lowStock.length,
      first_aiders_expired: firstAidersExpired.length,
      first_aiders_expiring: firstAidersExpiring.length,
    },
    trend,
    monthly,
    all_time: {
      inpatient: allInpatient.count ?? 0,
      bp: allBp.count ?? 0,
      checkups: allCheckups.count ?? 0,
      first_aiders: firstAidersAllTime.error ? firstAiders.length : (firstAidersAllTime.count ?? 0),
    },
    alerts,
  });
}
