import { z } from "zod";

export const bpSchema = z.object({
  employee_id: z.string().uuid().nullable().optional(), // ✅ NEW
  log_date: z.string(),
  log_time: z.string().nullable().optional(),
  employee_name: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  designation: z.string().nullable().optional(),
  bp_text: z.string().nullable().optional(),
  intervention: z.string().nullable().optional(),
});
