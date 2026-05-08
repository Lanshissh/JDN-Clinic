import { Router } from "express";
import { dailyReport, monthlyReport, analyticsReport } from "../controllers/reports.controller.js";

const router = Router();
router.get("/daily", dailyReport);
router.get("/monthly", monthlyReport);
router.get("/analytics", analyticsReport);
export default router;