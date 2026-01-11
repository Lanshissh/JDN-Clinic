import { supabase } from "../supabase.js";
import {
  inpatientCreateSchema,
  inpatientUpdateSchema,
} from "../validators/inpatient.schema.js";

export async function listInpatient(req, res) {
  // Optional filters: ?from=2026-01-01&to=2026-01-31&name=Juan
  const { from, to, name } = req.query;

  let q = supabase
    .from("inpatient_visits")
    .select("*")
    .order("visit_date", { ascending: false })
    .order("visit_time", { ascending: false })
    .limit(200);

  if (from) q = q.gte("visit_date", from);
  if (to) q = q.lte("visit_date", to);
  if (name) q = q.ilike("name", `%${name}%`);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
}

export async function getInpatientById(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("inpatient_visits")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
}

export async function createInpatient(req, res) {
  const parsed = inpatientCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  // ✅ Direct insert, symptoms is now just a text field in inpatient_visits
  const { data, error } = await supabase
    .from("inpatient_visits")
    .insert(parsed.data)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function updateInpatient(req, res) {
  const { id } = req.params;

  const parsed = inpatientUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from("inpatient_visits")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function deleteInpatient(req, res) {
  const { id } = req.params;

  const { error } = await supabase
    .from("inpatient_visits")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}