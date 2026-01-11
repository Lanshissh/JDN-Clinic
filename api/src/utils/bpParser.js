export function parseBp(text) {
  if (!text) return { systolic: null, diastolic: null };
  const match = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  return match
    ? { systolic: +match[1], diastolic: +match[2] }
    : { systolic: null, diastolic: null };
}