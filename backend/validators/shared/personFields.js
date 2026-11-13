import { z } from "zod";

/** Allow real human names, including accents, spaces, hyphens and apostrophes. */
export const personName = z
  .string()
  .trim()
  .min(2, "Enter a name with at least two characters.")
  .max(150, "Name must be 150 characters or fewer.")
  .regex(
    /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u,
    "Name must contain letters, not numbers or special symbols.",
  );

/** Numbers may contain telephone formatting, but never alphabetic characters. */
export const contactNumber = z
  .string()
  .trim()
  .min(7, "Enter a contact number with at least seven digits.")
  .max(30, "Contact number is too long.")
  .regex(
    /^[+0-9 ()-]+$/,
    "Contact number can contain digits and phone punctuation only.",
  )
  .refine(
    (value) => (value.match(/\d/g) || []).length >= 7,
    "Enter a valid contact number with at least seven digits.",
  );
