import { supabase } from "../supabase.js";

export async function globalSearch(req, res) {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.status(400).json({ error: "q is required" });
  if (q.length > 100) return res.status(400).json({ error: "q must be 100 characters or fewer" });

  const like = `%${q}%`;

  const [employees, checkups, inpatient, bp] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, department, designation, active")
      .ilike("full_name", like)
      .limit(10),
    supabase
      .from("checkup_requests")
      .select("id, request_date, employee_name, employee_id, status, symptoms")
      .ilike("employee_name", like)
      .order("request_date", { ascending: false })
      .limit(10),
    supabase
      .from("inpatient_visits")
      .select("id, visit_date, name, employee_id, department, chief_complaint")
      .ilike("name", like)
      .order("visit_date", { ascending: false })
      .limit(10),
    supabase
      .from("bp_logs")
      .select("id, log_date, employee_name, employee_id, bp_text, systolic, diastolic")
      .ilike("employee_name", like)
      .order("log_date", { ascending: false })
      .limit(10),
  ]);

  res.json({
    query: q,
    employees: employees.data ?? [],
    checkups: checkups.data ?? [],
    inpatient: inpatient.data ?? [],
    bp: bp.data ?? [],
    totals: {
      employees: (employees.data ?? []).length,
      checkups: (checkups.data ?? []).length,
      inpatient: (inpatient.data ?? []).length,
      bp: (bp.data ?? []).length,
    },
  });
}
