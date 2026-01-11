import { Router } from "express";
import {
  createBp,
  listBp,
  getBpById,
  updateBp,
  deleteBp,
} from "../controllers/bp.controller.js";

const router = Router();

router.get("/", listBp);
router.get("/:id", getBpById);
router.post("/", createBp);
router.put("/:id", updateBp);
router.delete("/:id", deleteBp);

export default router;