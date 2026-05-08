import { supabase } from "../supabase.js";
import {
  inpatientCreateSchema,
  inpatientUpdateSchema,
} from "../validators/inpatient.schema.js";
import {
  clinicImagesBucket,
  imageStoragePath,
  validateUploadedImages,
} from "../middleware/uploads.js";

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

  const validated = validateUploadedImages(files);
  if (!validated.ok) return res.status(400).json({ error: validated.error });

  const { data: existing, error: fetchErr } = await supabase
    .from("inpatient_visits")
    .select("image_urls")
    .eq("id", id)
    .single();

  if (fetchErr) return res.status(404).json({ error: "Inpatient record not found." });

  const uploadedUrls = [];
  const bucket = clinicImagesBucket();

  for (const image of validated.files) {
    const path = imageStoragePath("inpatient", id, image.ext);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, image.file.buffer, { contentType: image.mime, upsert: false });

    if (uploadError) return res.status(500).json({ error: "Storage upload failed." });

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    uploadedUrls.push(publicUrl);
  }

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
