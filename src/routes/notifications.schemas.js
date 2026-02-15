import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  body: z.object({
    deviceToken: z.string().min(1, 'Device token is required'),
    platform: z.enum(['ios', 'android']),
    deviceInfo: z.string().max(200).optional(),
  }),
});

export const removePushTokenSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    unreadOnly: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  }),
});

export const markReadSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
