import { z } from 'zod';

export const deleteAccountSchema = z.object({
  body: z.object({
    confirmation: z
      .string()
      .refine((val) => val === 'DELETE_MY_ACCOUNT', {
        message: 'Must send { confirmation: "DELETE_MY_ACCOUNT" } to confirm deletion',
      }),
  }),
});
