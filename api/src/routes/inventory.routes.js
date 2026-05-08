import { Router } from "express";
import {
  listInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  dispenseItem,
  getDispensingLogs,
  getLowStockItems,
} from "../controllers/inventory.controller.js";
import { requireUuidParam } from "../middleware/validate.js";

const router = Router();

router.get("/", listInventory);
router.get("/low-stock", getLowStockItems);
router.get("/dispense/logs", getDispensingLogs);
router.get("/:id", requireUuidParam(), getInventoryItem);
router.post("/", createInventoryItem);
router.post("/dispense", dispenseItem);
router.put("/:id", requireUuidParam(), updateInventoryItem);
router.delete("/:id", requireUuidParam(), deleteInventoryItem);

export default router;
