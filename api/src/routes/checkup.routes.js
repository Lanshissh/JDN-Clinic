import { Router } from "express";
import {
  listCheckups,
  getCheckupById,
  createCheckup,
  updateCheckup,
  deleteCheckup,
  bulkUpdateStatus,
  uploadCheckupImages,
} from "../controllers/checkup.controller.js";
import { requireUuidParam } from "../middleware/validate.js";
import { imageUpload } from "../middleware/uploads.js";

const router = Router();

router.get("/", listCheckups);
router.get("/:id", requireUuidParam(), getCheckupById);
router.post("/", createCheckup);
router.put("/:id", requireUuidParam(), updateCheckup);
router.delete("/:id", requireUuidParam(), deleteCheckup);
router.patch("/bulk-status", bulkUpdateStatus);
router.post("/:id/images", requireUuidParam(), imageUpload.array("files", 10), uploadCheckupImages);

export default router;
