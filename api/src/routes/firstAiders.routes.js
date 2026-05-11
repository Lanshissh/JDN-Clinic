import { Router } from "express";
import {
  createFirstAider,
  deleteFirstAider,
  getFirstAiderById,
  listFirstAiders,
  updateFirstAider,
} from "../controllers/firstAiders.controller.js";
import { requireUuidParam } from "../middleware/validate.js";

const router = Router();

router.get("/", listFirstAiders);
router.get("/:id", requireUuidParam(), getFirstAiderById);
router.post("/", createFirstAider);
router.put("/:id", requireUuidParam(), updateFirstAider);
router.delete("/:id", requireUuidParam(), deleteFirstAider);

export default router;
