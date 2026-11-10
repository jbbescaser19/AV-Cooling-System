import { z } from "zod";
import { str } from "../workspacePrimitives.js";
export const feedbackSchemas = {
  feedback: {
    update: z.strictObject({
      staffReply: str(0, 2000),
    }),
  },
};
