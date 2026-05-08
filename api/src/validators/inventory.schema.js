import { z } from "zod";
import { optionalText, shortText } from "./common.js";

export const inventoryCreateSchema = z.object({
  item_name: shortText(160),
  category: z.enum(["medicine", "supply"]).default("medicine"),
  unit: shortText(40).default("pcs"),
  quantity: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(10),
  description: optionalText(1000),
}).strict();

export const inventoryUpdateSchema = inventoryCreateSchema.partial();

export const dispenseSchema = z.object({
  inventory_id: z.string().uuid(),
  employee_id: z.string().uuid().nullable().optional(),
  employee_name: optionalText(150),
  record_type: z.enum(["checkup", "inpatient", "manual"]).default("manual"),
  record_id: z.string().uuid().nullable().optional(),
  quantity_dispensed: z.number().int().min(1),
  notes: optionalText(1000),
}).strict();
