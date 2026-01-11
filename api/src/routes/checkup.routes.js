import { Router } from "express";
import {
  listCheckups,
  getCheckupById,
  createCheckup,
  updateCheckup,
  deleteCheckup,
} from "../controllers/checkup.controller.js";

const router = Router();

router.get("/", listCheckups);
router.get("/:id", getCheckupById);
router.post("/", createCheckup);
router.put("/:id", updateCheckup);
router.delete("/:id", deleteCheckup);

export default router;