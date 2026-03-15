import { z } from "zod";

const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const chatMessageSchema = z.object({
  body: z.object({
    message: z
      .string()
      .trim()
      .min(1, "message is required")
      .max(500, "message must be 500 characters or fewer"),
  }),
  params: z.object({
    monthKey: z
      .string()
      .regex(monthKeyRegex, "monthKey must be in YYYY-MM format"),
  }),
  query: z.object({}).optional().default({}),
});