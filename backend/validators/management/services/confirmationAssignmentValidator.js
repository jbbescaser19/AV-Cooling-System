import { z } from "zod";

// A small team can be assigned in one confirmation. An empty list means 'assign later'.
export const technicianIdsSchema = z
  .array(z.number().int().positive())
  .max(6, "Choose at most six technicians.")
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Choose each technician only once.",
  )
  .default([]);
