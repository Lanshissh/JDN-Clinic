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

export async function uploadInpatientImages(req, res) {
  const { id } = req.params;
  const files = req.files;

  if (!files?.length) return res.status(400).json({ error: "No files uploaded." });

  await supabase.storage.createBucket("clinic-images", { public: true }).catch(() => {});

  const uploadedUrls = [];
  for (const file of files) {
    const ext = (file.mimetype.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `inpatient/${id}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("clinic-images")
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) return res.status(500).json({ error: `Storage upload failed: ${uploadError.message}` });

    const { data: { publicUrl } } = supabase.storage.from("clinic-images").getPublicUrl(path);
    uploadedUrls.push(publicUrl);
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("inpatient_visits")
    .select("image_urls")
    .eq("id", id)
    .single();

  if (fetchErr) return res.status(404).json({ error: "Inpatient record not found." });

  const existingUrls = Array.isArray(existing?.image_urls) ? existing.image_urls : [];
  const allUrls = [...existingUrls, ...uploadedUrls];

  const { data, error } = await supabase
    .from("inpatient_visits")
    .update({ image_urls: allUrls })
    .eq("id", id)
    .select("image_urls")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ image_urls: data.image_urls });
}