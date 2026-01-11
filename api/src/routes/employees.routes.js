import { Router } from "express";
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
} from "../controllers/employees.controller.js";
import { employeeHistory } from "../controllers/employees.controller.js";

const router = Router();

router.get("/", listEmployees);
router.get("/:id", getEmployeeById);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.delete("/:id", deactivateEmployee);
router.get("/:id/history", employeeHistory);

export default router;