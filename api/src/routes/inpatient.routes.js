import { Router } from "express";
import multer from "multer";
import {
  listInpatient,
  getInpatientById,
  createInpatient,
  updateInpatient,
  deleteInpatient,
  uploadInpatientImages,
} from "../controllers/inpatient.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.get("/", listInpatient);
router.get("/:id", getInpatientById);
router.post("/", createInpatient);
router.put("/:id", updateInpatient);
router.delete("/:id", deleteInpatient);
router.post("/:id/images", upload.array("files", 10), uploadInpatientImages);

export default router;
