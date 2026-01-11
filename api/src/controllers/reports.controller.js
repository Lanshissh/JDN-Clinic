import { supabase } from "../supabase.js";

export async function dailyReport(req, res) {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const [inpatient, bp, checkups] = await Promise.all([
    supabase.from("inpatient_visits").select("*").eq("visit_date", date).order("visit_time", { ascending: true }),
    supabase.from("bp_logs").select("*").eq("log_date", date).order("log_time", { ascending: true }),
    supabase.from("checkup_requests").select("*").eq("request_date", date).order("created_at", { ascending: true }),
  ]);

  if (inpatient.error) return res.status(500).json({ error: inpatient.error.message });
  if (bp.error) return res.status(500).json({ error: bp.error.message });
  if (checkups.error) return res.status(500).json({ error: checkups.error.message });

  res.json({
    date,
    totals: {
      inpatient: inpatient.data.length,
      bp: bp.data.length,
      checkups: checkups.data.length,
    },
    inpatient: inpatient.data,
    bp: bp.data,
    checkups: checkups.data,
  });
}

export async function monthlyReport(req, res) {
  const month = req.query.month; // YYYY-MM
  if (!month) return res.status(400).json({ error: "month is required (YYYY-MM)" });

  const from = `${month}-01`;
  const to = `${month}-31`;

  const [inpatient, bp, checkups] = await Promise.all([
    supabase.from("inpatient_visits").select("visit_date").gte("visit_date", from).lte("visit_date", to),
    supabase.from("bp_logs").select("log_date").gte("log_date", from).lte("log_date", to),
    supabase.from("checkup_requests").select("request_date,status").gte("request_date", from).lte("request_date", to),
  ]);

  if (inpatient.error) return res.status(500).json({ error: inpatient.error.message });
  if (bp.error) return res.status(500).json({ error: bp.error.message });
  if (checkups.error) return res.status(500).json({ error: checkups.error.message });

  res.json({
    month,
    totals: {
      inpatient: inpatient.data.length,
      bp: bp.data.length,
      checkups: checkups.data.length,
      checkups_done: checkups.data.filter(x => x.status === "done").length,
    },
  });
}