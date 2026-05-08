import { Router } from "express";
import {
  listInpatient,
  getInpatientById,
  createInpatient,
  updateInpatient,
  deleteInpatient,
  uploadInpatientImages,
} from "../controllers/inpatient.controller.js";
import { requireUuidParam } from "../middleware/validate.js";
import { imageUpload } from "../middleware/uploads.js";

const router = Router();

router.get("/", listInpatient);
router.get("/:id", requireUuidParam(), getInpatientById);
router.post("/", createInpatient);
router.put("/:id", requireUuidParam(), updateInpatient);
router.delete("/:id", requireUuidParam(), deleteInpatient);
router.post("/:id/images", requireUuidParam(), imageUpload.array("files", 10), uploadInpatientImages);

export default router;
