import { z } from 'zod';

const passwordRules = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

const emailRule = z
  .string()
  .email('Invalid email address')
  .max(255)
  .transform((v) => v.trim().toLowerCase());

const deviceInfoRule = z.string().max(500).optional();

export const registerSchema = z.object({
  body: z.object({
    email: emailRule,
    password: passwordRules,
    fullName: z.string().max(200).trim().min(2, 'Name must be at least 2 characters'),
    language: z.enum(['bg', 'en']).optional().default('bg'),
    deviceInfo: deviceInfoRule,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailRule,
    password: z.string().min(1, 'Password is required').max(128),
    deviceInfo: deviceInfoRule,
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailRule,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordRules,
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});
