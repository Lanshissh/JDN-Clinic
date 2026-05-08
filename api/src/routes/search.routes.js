import { Router } from "express";
import { globalSearch } from "../controllers/search.controller.js";

const router = Router();
router.get("/", globalSearch); // ?q=Juan
export default router;
