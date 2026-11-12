import { z } from "zod";
import { parseManagementInput } from "../parseManagementInput.js";
const schema = z.strictObject({
  verifiedExternally: z.literal(true),
  reference: z.string().trim().min(6).max(100),
  note: z.string().trim().min(10).max(250),
});
export const validateManualTransferConfirmation = (value) =>
  parseManagementInput(schema, value);
