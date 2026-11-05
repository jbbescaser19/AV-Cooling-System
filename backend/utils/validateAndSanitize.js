import { z } from "zod";

export function validateRegister(data) {
  const registerSchema = z.object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters."),

    email: z.string().trim().email("Enter a valid email address."),

    phone: z.string().trim().min(10, "Enter a valid phone number."),

    password: z.string().min(8, "Password must be at least 8 characters."),

    acceptTerms: z.literal(true, {
      error: "You must accept the Terms and Conditions.",
    }),
  });

  const result = registerSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => issue.message);

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      fullName: result.data.fullName,
      email: result.data.email.toLowerCase(),
      phone: result.data.phone,
      password: result.data.password,
      acceptTerms: result.data.acceptTerms,
    },
  };
}

export function validateLogin(data) {
  const loginSchema = z.object({
    email: z.string().min(2),
    password: z.string().min(6),
  });

  const result = loginSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => issue.message);

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      email: result.data.email.toLowerCase(),
      password: result.data.password,
    },
  };
}
