import { supabase } from "../supabase.js";
import {
  checkupCreateSchema,
  checkupUpdateSchema,
} from "../validators/checkup.schema.js";

export async function listCheckups(req, res) {
  // Optional filters:
  // ?from=2026-01-01&to=2026-01-31&status=open&name=juan
  const { from, to, status, name } = req.query;

  let q = supabase
    .from("checkup_requests")
    .select("*")
    .order("request_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (from) q = q.gte("request_date", from);
  if (to) q = q.lte("request_date", to);
  if (status) q = q.eq("status", status);
  if (name) q = q.ilike("employee_name", `%${name}%`);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function getCheckupById(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("checkup_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
}

export async function createCheckup(req, res) {
  const parsed = checkupCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from("checkup_requests")
    .insert(parsed.data)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function updateCheckup(req, res) {
  const { id } = req.params;

  const parsed = checkupUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from("checkup_requests")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function deleteCheckup(req, res) {
  const { id } = req.params;

  const { error } = await supabase
    .from("checkup_requests")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}