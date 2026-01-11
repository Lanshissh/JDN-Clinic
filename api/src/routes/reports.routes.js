import { Router } from "express";
import { dailyReport, monthlyReport } from "../controllers/reports.controller.js";

const router = Router();
router.get("/daily", dailyReport);     // ?date=YYYY-MM-DD
router.get("/monthly", monthlyReport); // ?month=YYYY-MM (e.g. 2025-01)
export default router;