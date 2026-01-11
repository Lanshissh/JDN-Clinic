import { z } from "zod";

export const employeeCreateSchema = z.object({
  employee_code: z.string().trim().min(1).nullable().optional(),
  full_name: z.string().trim().min(1),
  age: z.number().int().min(0).max(130).nullable().optional(),
  department: z.string().trim().nullable().optional(),
  designation: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();