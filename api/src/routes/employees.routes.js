import { Router } from "express";
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  createEmployeesBulk,
  updateEmployee,
  deactivateEmployee,
} from "../controllers/employees.controller.js";
import { employeeHistory } from "../controllers/employees.controller.js";
import { requireUuidParam } from "../middleware/validate.js";

const router = Router();

router.get("/", listEmployees);
router.get("/:id", requireUuidParam(), getEmployeeById);
router.post("/", createEmployee);
router.post("/bulk", createEmployeesBulk);
router.put("/:id", requireUuidParam(), updateEmployee);
router.delete("/:id", requireUuidParam(), deactivateEmployee);
router.get("/:id/history", requireUuidParam(), employeeHistory);

export default router;
