import { z } from "zod";
import { dateString, optionalText, shortText } from "./common.js";

export const employeeCreateSchema = z.object({
  full_name: shortText(150),
  birthday: dateString.nullable().optional(),
  age: z.number().int().min(0).max(130).nullable().optional(),
  department: optionalText(120),
  designation: optionalText(120),
  active: z.boolean().optional(),
}).strict();

export const employeeUpdateSchema = employeeCreateSchema.partial();
