import { z } from "zod";
import {
  id,
  str,
  status,
  datetime,
  positiveQty,
} from "../workspacePrimitives.js";
import { technicianIdsSchema } from "../services/confirmationAssignmentValidator.js";
export const facebookRequestSchemas = {
  "facebook-requests": {
    create: z.strictObject({
      requestKind: status("AIRCON", "SERVICE"),
      customerName: str(2, 150),
      contactNumber: str(7, 30),
      address: str(5, 2000),
      scheduledStart: datetime,
      variantId: id.nullable().default(null),
      quantity: positiveQty.default(1),
      serviceTypeId: id.nullable().default(null),
      notes: str(0, 1000),
      conversationUrl: z.string().trim().max(500).default(""),
      airconBrand: str(0, 100).default(""),
      airconModel: str(0, 150).default(""),
      airconHp: z.coerce.number().min(0.5).max(20).nullable().default(null),
    }),
    update: z.strictObject({
      action: status("CONFIRM", "CONVERT", "CANCEL"),
      note: str(0, 1000),
      technicianIds: technicianIdsSchema,
    }),
  },
};
