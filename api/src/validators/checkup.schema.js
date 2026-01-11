import { z } from "zod";

export const checkupCreateSchema = z.object({
  employee_id: z.string().uuid().nullable().optional(), // ✅ NEW
  request_date: z.string().optional(), // YYYY-MM-DD (default in DB if omitted)
  employee_name: z.string().min(1),
  symptoms: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  status: z.enum(["open", "done", "followup"]).optional(),
});

export const checkupUpdateSchema = checkupCreateSchema.partial();
