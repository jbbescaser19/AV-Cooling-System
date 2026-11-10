import { z } from "zod";
export const id = z.coerce.number().int().positive();
export const str = (min = 1, max = 150) => z.string().trim().min(min).max(max);
export const status = (...values) => z.enum(values);
export const money = z.coerce.number().finite().min(0).max(100000000);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const datetime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export const positiveQty = z.coerce.number().int().min(1).max(100000);
