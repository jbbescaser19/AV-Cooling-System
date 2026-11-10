import { Router } from "express";
import { publicCatalogAvailabilityController } from "../../controllers/public/catalogAvailabilityController.js";

const router = Router();
router.get("/availability", publicCatalogAvailabilityController);
export default router;
