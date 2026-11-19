import { z } from "zod";

import { personName, contactNumber } from "../../shared/personFields.js";

import {
  id,
  str,
  status,
  datetime,
  positiveQty,
} from "../workspacePrimitives.js";

import { technicianIdsSchema } from "../services/confirmationAssignmentValidator.js";

import { DELIVERY_AREAS } from "../../../services/shared/deliveryPricingService.js";

const deliveryFields = {
  deliveryArea: z.enum([...Object.keys(DELIVERY_AREAS), "OTHER"]).optional(),

  customDeliveryFee: z.number().finite().min(0).max(99999.99).optional(),

  deliveryFeeReason: str(0, 255).optional(),
};

export const facebookRequestSchemas = {
  "facebook-requests": {
    create: z
      .strictObject({
        requestKind: status("AIRCON", "SERVICE"),
        customerName: personName,
        contactNumber,

        address: str(5, 2000),

        destinationAddress: str(0, 2000).default(""),

        facebookAccount: str(2, 150),

        scheduledStart: datetime,

        variantId: id.nullable().default(null),

        quantity: positiveQty.default(1),

        serviceTypeId: id.nullable().default(null),

        notes: str(0, 1000),

        conversationUrl: z.string().trim().max(500).default(""),

        airconBrand: str(0, 100).default(""),

        airconModel: str(0, 150).default(""),

        airconHp: z.preprocess(
          (value) =>
            value == null || (typeof value === "string" && !value.trim())
              ? null
              : value,

          z.coerce.number().finite().min(0.5).max(20).nullable(),
        ),

        ...deliveryFields,
      })
      .superRefine((data, context) => {
        if (data.requestKind === "SERVICE" && data.airconHp === null) {
          context.addIssue({
            code: "custom",
            path: ["airconHp"],
            message: "Horsepower (HP) is required for service requests.",
          });
        }

        if (data.requestKind === "AIRCON" && !data.deliveryArea) {
          context.addIssue({
            code: "custom",
            path: ["deliveryArea"],
            message: "Select a delivery area.",
          });
        }
      }),

    update: z.strictObject({
      action: status("CONFIRM", "CONVERT", "CANCEL"),

      note: str(0, 1000),

      technicianIds: technicianIdsSchema,

      deliveryAddress: str(5, 2000).optional(),

      ...deliveryFields,
    }),
  },
};
