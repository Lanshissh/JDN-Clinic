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

const router = Router();

router.get("/", listInventory);
router.get("/low-stock", getLowStockItems);
router.get("/dispense/logs", getDispensingLogs);
router.get("/:id", getInventoryItem);
router.post("/", createInventoryItem);
router.post("/dispense", dispenseItem);
router.put("/:id", updateInventoryItem);
router.delete("/:id", deleteInventoryItem);

export default router;
