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

export async function bulkUpdateStatus(req, res) {
  const { ids, status } = req.body;
  const allowed = ["open", "done", "followup"];

  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: "ids must be a non-empty array." });
  if (!allowed.includes(status))
    return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });

  const { error } = await supabase
    .from("checkup_requests")
    .update({ status })
    .in("id", ids);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, updated: ids.length });
}

export async function uploadCheckupImages(req, res) {
  const { id } = req.params;
  const files = req.files;

  if (!files?.length) return res.status(400).json({ error: "No files uploaded." });

  // Ensure bucket exists (ignore already-exists error)
  await supabase.storage.createBucket("clinic-images", { public: true }).catch(() => {});

  const uploadedUrls = [];
  for (const file of files) {
    const ext = (file.mimetype.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `checkups/${id}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("clinic-images")
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) return res.status(500).json({ error: `Storage upload failed: ${uploadError.message}` });

    const { data: { publicUrl } } = supabase.storage.from("clinic-images").getPublicUrl(path);
    uploadedUrls.push(publicUrl);
  }

  // Fetch existing image_urls and append
  const { data: existing, error: fetchErr } = await supabase
    .from("checkup_requests")
    .select("image_urls")
    .eq("id", id)
    .single();

  if (fetchErr) return res.status(404).json({ error: "Checkup not found." });

  const existingUrls = Array.isArray(existing?.image_urls) ? existing.image_urls : [];
  const allUrls = [...existingUrls, ...uploadedUrls];

  const { data, error } = await supabase
    .from("checkup_requests")
    .update({ image_urls: allUrls })
    .eq("id", id)
    .select("image_urls")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ image_urls: data.image_urls });
}