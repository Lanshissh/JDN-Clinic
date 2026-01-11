import { supabase } from "../supabase.js";
import {
  employeeCreateSchema,
  employeeUpdateSchema,
} from "../validators/employees.schema.js";

export async function listEmployees(req, res) {
  // Optional: ?q=juan&active=true
  const { q, active } = req.query;

  let query = supabase
    .from("employees")
    .select("*")
    .order("full_name", { ascending: true })
    .limit(300);

  if (active === "true") query = query.eq("active", true);
  if (active === "false") query = query.eq("active", false);

  if (q) query = query.ilike("full_name", `%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function getEmployeeById(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
}

export async function createEmployee(req, res) {
  const parsed = employeeCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from("employees")
    .insert(parsed.data)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function updateEmployee(req, res) {
  const { id } = req.params;

  const parsed = employeeUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from("employees")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

// Soft delete: set active=false
export async function deactivateEmployee(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("employees")
    .update({ active: false })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function employeeHistory(req, res) {
  const { id } = req.params;
  const { from, to } = req.query; // optional YYYY-MM-DD

  // Fetch employee info
  const emp = await supabase.from("employees").select("*").eq("id", id).single();
  if (emp.error) return res.status(404).json({ error: emp.error.message });

  // Base filters
  const inpatientQ = supabase
    .from("inpatient_visits")
    .select("*")
    .eq("employee_id", id)
    .order("visit_date", { ascending: false })
    .order("visit_time", { ascending: false })
    .limit(300);

  const bpQ = supabase
    .from("bp_logs")
    .select("*")
    .eq("employee_id", id)
    .order("log_date", { ascending: false })
    .order("log_time", { ascending: false })
    .limit(300);

  const checkupsQ = supabase
    .from("checkup_requests")
    .select("*")
    .eq("employee_id", id)
    .order("request_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  // Optional date filters
  if (from) {
    inpatientQ.gte("visit_date", from);
    bpQ.gte("log_date", from);
    checkupsQ.gte("request_date", from);
  }
  if (to) {
    inpatientQ.lte("visit_date", to);
    bpQ.lte("log_date", to);
    checkupsQ.lte("request_date", to);
  }

  const [inpatient, bp, checkups] = await Promise.all([inpatientQ, bpQ, checkupsQ]);

  if (inpatient.error) return res.status(500).json({ error: inpatient.error.message });
  if (bp.error) return res.status(500).json({ error: bp.error.message });
  if (checkups.error) return res.status(500).json({ error: checkups.error.message });

  res.json({
    employee: emp.data,
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
