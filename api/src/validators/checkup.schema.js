import { z } from "zod";
import { dateString, optionalText, shortText } from "./common.js";

export const checkupCreateSchema = z.object({
  employee_id: z.string().uuid().nullable().optional(),
  request_date: dateString.optional(),
  employee_name: shortText(150),
  symptoms: optionalText(2000),
  remarks: optionalText(2000),
  status: z.enum(["open", "done", "followup"]).optional(),
}).strict();

export const checkupUpdateSchema = checkupCreateSchema.partial();
