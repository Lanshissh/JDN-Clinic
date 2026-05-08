import { Router } from "express";
import multer from "multer";
import {
  listCheckups,
  getCheckupById,
  createCheckup,
  updateCheckup,
  deleteCheckup,
  bulkUpdateStatus,
  uploadCheckupImages,
} from "../controllers/checkup.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.get("/", listCheckups);
router.get("/:id", getCheckupById);
router.post("/", createCheckup);
router.put("/:id", updateCheckup);
router.delete("/:id", deleteCheckup);
router.patch("/bulk-status", bulkUpdateStatus);
router.post("/:id/images", upload.array("files", 10), uploadCheckupImages);

export default router;
