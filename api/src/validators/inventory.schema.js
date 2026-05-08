import { z } from "zod";

export const inventoryCreateSchema = z.object({
  item_name: z.string().min(1),
  category: z.enum(["medicine", "supply"]).default("medicine"),
  unit: z.string().min(1).default("pcs"),
  quantity: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(10),
  description: z.string().nullable().optional(),
});

export const inventoryUpdateSchema = inventoryCreateSchema.partial();

export const dispenseSchema = z.object({
  inventory_id: z.string().uuid(),
  employee_id: z.string().uuid().nullable().optional(),
  employee_name: z.string().nullable().optional(),
  record_type: z.enum(["checkup", "inpatient", "manual"]).default("manual"),
  record_id: z.string().uuid().nullable().optional(),
  quantity_dispensed: z.number().int().min(1),
  notes: z.string().nullable().optional(),
});
