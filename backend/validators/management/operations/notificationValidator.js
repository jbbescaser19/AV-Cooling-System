import { z } from "zod";
export const notificationSchemas = {
  notifications: {
    update: z.strictObject({
      isRead: z.boolean(),
    }),
  },
};
