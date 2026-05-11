import { z } from "zod";
import { dateString, optionalText, shortText } from "./common.js";

export const employeeCreateSchema = z.object({
  full_name: shortText(150),
  birthday: dateString.nullable().optional(),
  age: z.number().int().min(0).max(130).nullable().optional(),
  business_unit: optionalText(160),
  department: optionalText(120),
  designation: optionalText(120),
  active: z.boolean().optional(),
}).strict();

export const employeeUpdateSchema = employeeCreateSchema.partial();

export const employeeBulkCreateSchema = z.object({
  employees: z.array(employeeCreateSchema).min(1).max(500),
}).strict();
