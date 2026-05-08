import { Router } from "express";
import {
  createBp,
  listBp,
  getBpById,
  updateBp,
  deleteBp,
} from "../controllers/bp.controller.js";
import { requireUuidParam } from "../middleware/validate.js";

const router = Router();

router.get("/", listBp);
router.get("/:id", requireUuidParam(), getBpById);
router.post("/", createBp);
router.put("/:id", requireUuidParam(), updateBp);
router.delete("/:id", requireUuidParam(), deleteBp);

export default router;
