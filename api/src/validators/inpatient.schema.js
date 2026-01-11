import { z } from "zod";

export const inpatientCreateSchema = z.object({
  employee_id: z.string().uuid().nullable().optional(), // ✅ NEW
  visit_date: z.string(), // YYYY-MM-DD
  visit_time: z.string().nullable().optional(), // HH:MM
  name: z.string().min(1),
  age: z.number().int().nullable().optional(),
  department: z.string().nullable().optional(),
  chief_complaint: z.string().nullable().optional(),
  symptoms: z.string().nullable().optional(),
  bp_text: z.string().nullable().optional(),
  intervention: z.string().nullable().optional(),
  disposition: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const inpatientUpdateSchema = inpatientCreateSchema.partial();