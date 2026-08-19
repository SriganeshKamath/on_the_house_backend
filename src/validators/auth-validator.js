const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(12)
  .max(72)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72);

const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[A-Za-z0-9_]+$/),
  email: z.string().max(254).email().transform((value) => value.trim().toLowerCase()),
  password: passwordSchema,
});

const loginSchema = z.object({
  identifier: z.string().min(1).max(254).transform((value) => value.trim()),
  password: passwordSchema,
});

module.exports = { registerSchema, loginSchema };
