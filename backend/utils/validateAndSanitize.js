import { email, z } from "zod"; //used to  validate data like form

export function validateRegister(data) {
  const registerSchema = z.object({
    //defines rules for valid data
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters."),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z.string().trim().min(10, "Enter a valid phone number."),
    password: z.string().min(8, "Password must be at least 8 characters."),
  });

  const result = registerSchema.safeParse(data); //check if data is valid without crashing

  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message);
    return { success: false, errors };
  }
  return {
    success: true,
    data: {
      fullName: result.data.fullName,
      email: result.data.email.toLowerCase(),
      phone: result.data.phone,
      password: result.data.password,
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
    const errors = result.error.issues.map((e) => e.message);
    return { success: false, errors };
  }
  return {
    success: true,
    data: {
      email: result.data.email.toLowerCase(),
      password: result.data.password,
    },
  };
}
