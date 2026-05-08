import { z } from "zod";
import { dateString, optionalText, optionalTimeString } from "./common.js";

export const bpSchema = z.object({
  employee_id: z.string().uuid().nullable().optional(),
  log_date: dateString,
  log_time: optionalTimeString,
  employee_name: optionalText(150),
  age: z.number().int().min(0).max(130).nullable().optional(),
  designation: optionalText(120),
  bp_text: optionalText(40),
  intervention: optionalText(1000),
}).strict();
