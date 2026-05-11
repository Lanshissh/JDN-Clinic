import { supabase } from "../supabase.js";
import {
  firstAiderCreateSchema,
  firstAiderUpdateSchema,
} from "../validators/firstAiders.schema.js";
import { enrichFirstAider, enrichFirstAiders } from "../utils/firstAiderStatus.js";

const TABLE = "first_aiders";

export async function listFirstAiders(req, res) {
  const { q, remarks, location } = req.query;

  let query = supabase
    .from(TABLE)
    .select("*")
    .order("full_name", { ascending: true })
    .limit(500);

  if (q) query = query.ilike("full_name", `%${q}%`);
  if (remarks) query = query.eq("remarks", remarks);
  if (location) query = query.eq("assigned_location", location);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(enrichFirstAiders(data));
}

export async function getFirstAiderById(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(enrichFirstAider(data));
}

export async function createFirstAider(req, res) {
  const parsed = firstAiderCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from(TABLE)
    .insert(parsed.data)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(enrichFirstAider(data));
}

export async function updateFirstAider(req, res) {
  const { id } = req.params;

  const parsed = firstAiderUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(enrichFirstAider(data));
}

export async function deleteFirstAider(req, res) {
  const { id } = req.params;

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
}
