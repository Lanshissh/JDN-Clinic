import { z } from "zod";

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.");
export const optionalDateString = dateString.nullable().optional();
export const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM or HH:MM:SS.");
export const optionalTimeString = timeString.nullable().optional();

export const shortText = (max = 150) => z.string().trim().min(1).max(max);
export const optionalText = (max = 1000) => z.string().trim().max(max).nullable().optional();
