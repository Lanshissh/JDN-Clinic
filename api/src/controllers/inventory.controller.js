import { supabase } from "../supabase.js";
import {
  inventoryCreateSchema,
  inventoryUpdateSchema,
  dispenseSchema,
} from "../validators/inventory.schema.js";

export async function listInventory(req, res) {
  const { category } = req.query;

  let q = supabase
    .from("clinic_inventory")
    .select("*")
    .order("category")
    .order("item_name");

  if (category) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  // Flag low-stock items
  const items = (data ?? []).map((item) => ({
    ...item,
    is_low_stock: item.quantity <= item.low_stock_threshold,
  }));

  res.json(items);
}

export async function getInventoryItem(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("clinic_inventory")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json({ ...data, is_low_stock: data.quantity <= data.low_stock_threshold });
}

export async function createInventoryItem(req, res) {
  const parsed = inventoryCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from("clinic_inventory")
    .insert(parsed.data)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function updateInventoryItem(req, res) {
  const { id } = req.params;
  const parsed = inventoryUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { data, error } = await supabase
    .from("clinic_inventory")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function deleteInventoryItem(req, res) {
  const { id } = req.params;
  const { error } = await supabase.from("clinic_inventory").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}

export async function dispenseItem(req, res) {
  const parsed = dispenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { inventory_id, quantity_dispensed } = parsed.data;

  // Check current stock
  const { data: item, error: fetchErr } = await supabase
    .from("clinic_inventory")
    .select("id, quantity, item_name")
    .eq("id", inventory_id)
    .single();

  if (fetchErr) return res.status(404).json({ error: "Item not found." });
  if (item.quantity < quantity_dispensed) {
    return res.status(400).json({
      error: `Not enough stock. Available: ${item.quantity}, requested: ${quantity_dispensed}.`,
    });
  }

  // Deduct stock
  const { error: updateErr } = await supabase
    .from("clinic_inventory")
    .update({ quantity: item.quantity - quantity_dispensed, updated_at: new Date().toISOString() })
    .eq("id", inventory_id);

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  // Log dispensing
  const { data: log, error: logErr } = await supabase
    .from("dispensing_logs")
    .insert(parsed.data)
    .select("*")
    .single();

  if (logErr) return res.status(500).json({ error: logErr.message });

  res.json({ ok: true, log, remaining_quantity: item.quantity - quantity_dispensed });
}

export async function getDispensingLogs(req, res) {
  const { inventory_id, employee_id, from, to } = req.query;

  let q = supabase
    .from("dispensing_logs")
    .select("*, clinic_inventory(item_name, unit)")
    .order("dispensed_at", { ascending: false })
    .limit(200);

  if (inventory_id) q = q.eq("inventory_id", inventory_id);
  if (employee_id) q = q.eq("employee_id", employee_id);
  if (from) q = q.gte("dispensed_at", from);
  if (to) q = q.lte("dispensed_at", to + "T23:59:59Z");

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
}

export async function getLowStockItems(req, res) {
  const { data, error } = await supabase
    .from("clinic_inventory")
    .select("id, item_name, category, unit, quantity, low_stock_threshold")
    .order("quantity");

  if (error) return res.status(500).json({ error: error.message });

  const low = (data ?? []).filter((i) => i.quantity <= i.low_stock_threshold);
  res.json(low);
}
