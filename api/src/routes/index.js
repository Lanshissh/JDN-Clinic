import { Router } from "express";
import inpatientRoutes from "./inpatient.routes.js";
import bpRoutes from "./bp.routes.js";
import checkupRoutes from "./checkup.routes.js";
import employeesRoutes from "./employees.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import reportsRoutes from "./reports.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import searchRoutes from "./search.routes.js";
import firstAidersRoutes from "./firstAiders.routes.js";

const router = Router();

router.use("/inpatient", inpatientRoutes);
router.use("/bp", bpRoutes);
router.use("/checkups", checkupRoutes);
router.use("/employees", employeesRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportsRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/search", searchRoutes);
router.use("/first-aiders", firstAidersRoutes);

export default router;
