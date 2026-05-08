import { z } from "zod";
import { dateString, optionalText, optionalTimeString, shortText } from "./common.js";

export const inpatientCreateSchema = z.object({
  employee_id: z.string().uuid().nullable().optional(),
  visit_date: dateString,
  visit_time: optionalTimeString,
  name: shortText(150),
  age: z.number().int().min(0).max(130).nullable().optional(),
  department: optionalText(120),
  chief_complaint: optionalText(500),
  symptoms: optionalText(2000),
  bp_text: optionalText(40),
  intervention: optionalText(1000),
  disposition: optionalText(500),
  notes: optionalText(2000),
}).strict();

export const inpatientUpdateSchema = inpatientCreateSchema.partial();
