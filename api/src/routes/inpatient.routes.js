import { Router } from "express";
import {
  listInpatient,
  getInpatientById,
  createInpatient,
  updateInpatient,
  deleteInpatient,
} from "../controllers/inpatient.controller.js";

const router = Router();

router.get("/", listInpatient);
router.get("/:id", getInpatientById);
router.post("/", createInpatient);
router.put("/:id", updateInpatient);
router.delete("/:id", deleteInpatient);

export default router;