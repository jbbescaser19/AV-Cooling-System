import { Router } from "express";

import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";
import { requireStaffAuth } from "../../middleware/requireStaffAuth.js";
import { subscribeRealtime } from "../../services/realtime/realtimeEventService.js";

const router = Router();

function stream(audience) {
  return (req, res, next) => {
    Promise.resolve(subscribeRealtime(req, res, audience)).catch(next);
  };
}

router.get("/staff", requireStaffAuth, stream("staff"));

router.get("/customer", requireCustomerAuth, stream("customer"));

router.get("/public", stream("public"));

export default router;
