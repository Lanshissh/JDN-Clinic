import { z } from "zod";
import { dateString, optionalDateString, optionalText, shortText } from "./common.js";

const firstAiderFields = z.object({
  full_name: shortText(150),
  business_unit: shortText(160),
  training_start_date: dateString,
  training_end_date: optionalDateString,
  remarks: optionalText(120),
  assigned_location: shortText(120),
}).strict();

function withValidDateRange(schema) {
  return schema.refine(
    (data) => {
      if (!data.training_start_date || !data.training_end_date) return true;
      return data.training_end_date >= data.training_start_date;
    },
    {
      path: ["training_end_date"],
      message: "Training end date cannot be before training start date.",
    }
  );
}

export const firstAiderCreateSchema = withValidDateRange(firstAiderFields);

export const firstAiderUpdateSchema = withValidDateRange(firstAiderFields.partial());
