import { supabase } from "../supabase.js";
import { bpSchema } from "../validators/bp.schema.js";
import { parseBp } from "../utils/bpParser.js";

export async function listBp(req, res) {
  const { data, error } = await supabase
    .from("bp_logs")
    .select("*")
    .order("log_date", { ascending: false })
    .order("log_time", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function getBpById(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("bp_logs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
}

export async function createBp(req, res) {
  const parsed = bpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { systolic, diastolic } = parseBp(parsed.data.bp_text);

  const { data, error } = await supabase
    .from("bp_logs")
    .insert({ ...parsed.data, systolic, diastolic })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function updateBp(req, res) {
  const { id } = req.params;

  // allow partial updates
  const parsed = bpSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  // get existing so we can correctly recompute systolic/diastolic
  const existing = await supabase
    .from("bp_logs")
    .select("*")
    .eq("id", id)
    .single();

  if (existing.error) return res.status(404).json({ error: existing.error.message });

  const merged = { ...existing.data, ...parsed.data };
  const { systolic, diastolic } = parseBp(merged.bp_text);

  const { data, error } = await supabase
    .from("bp_logs")
    .update({ ...parsed.data, systolic, diastolic })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function deleteBp(req, res) {
  const { id } = req.params;

  const { error } = await supabase
    .from("bp_logs")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}