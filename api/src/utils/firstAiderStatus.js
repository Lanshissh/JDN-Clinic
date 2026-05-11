const MS_PER_DAY = 24 * 60 * 60 * 1000;

function positiveNumberEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const FIRST_AID_EXPIRING_DAYS = positiveNumberEnv("FIRST_AID_EXPIRING_DAYS", 60);

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  const text = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const d = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizedIsoDate(dateStr) {
  const d = parseIsoDate(dateStr);
  if (!d) return null;
  return isoDate(d);
}

function daysBetween(fromDateStr, toDateStr) {
  const from = parseIsoDate(fromDateStr);
  const to = parseIsoDate(toDateStr);
  if (!from || !to) return null;

  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function todayInTimeZone(timeZone = "Asia/Manila") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasAnyRemark(row, patterns) {
  const remarks = normalized(row?.remarks);
  return patterns.some((pattern) => pattern.test(remarks));
}

function automaticRemarks(row, status, statusLabel) {
  if (status === "inactive") return row?.remarks || statusLabel;
  if (status === "expired") return "Expired Training";
  if (status === "expiring") return "Expiring Soon";
  return "Active";
}

export function firstAiderTrainingStatus(
  row,
  {
    today = todayInTimeZone(),
    expiringDays = FIRST_AID_EXPIRING_DAYS,
  } = {}
) {
  const inactive = hasAnyRemark(row, [/resigned/i, /inactive/i]);
  const manualExpired = hasAnyRemark(row, [/expired/i]);
  const manualExpiring = hasAnyRemark(row, [/expiring/i, /renewal/i, /for renewal/i]);
  const trainingBaseDate = row?.training_end_date || row?.training_start_date;
  const trainingExpiryDate = normalizedIsoDate(trainingBaseDate);
  const daysUntilExpiry = trainingExpiryDate ? daysBetween(today, trainingExpiryDate) : null;

  let status = "active";
  let statusLabel = "Active";

  if (inactive) {
    status = "inactive";
    statusLabel = "Inactive / Resigned";
  } else if (manualExpired || (daysUntilExpiry != null && daysUntilExpiry < 0)) {
    status = "expired";
    statusLabel = "Expired Training";
  } else if (
    manualExpiring ||
    (daysUntilExpiry != null && daysUntilExpiry >= 0 && daysUntilExpiry <= expiringDays)
  ) {
    status = "expiring";
    statusLabel = "Expiring Soon";
  }

  const remarks = automaticRemarks(row, status, statusLabel);

  return {
    training_expiry_date: trainingExpiryDate,
    days_until_expiry: daysUntilExpiry,
    training_status: status,
    training_status_label: statusLabel,
    automatic_remarks: remarks,
    is_training_expired: status === "expired",
    is_training_expiring: status === "expiring",
    first_aid_expiring_days: expiringDays,
  };
}

export function enrichFirstAider(row, options) {
  return {
    ...row,
    ...firstAiderTrainingStatus(row, options),
  };
}

export function enrichFirstAiders(rows, options) {
  return (rows ?? []).map((row) => enrichFirstAider(row, options));
}
