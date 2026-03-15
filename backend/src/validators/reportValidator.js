import { z } from "zod";

const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const generateReportSchema = z.object({
  body: z.object({
    monthKey: z
      .string()
      .regex(monthKeyRegex, "monthKey must be in YYYY-MM format"),
    timezone: z
      .string()
      .optional()
      .default("UTC")
      .refine(
        (tz) => {
          try {
            Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
            return true;
          } catch {
            return false;
          }
        },
        { message: "Invalid timezone" }
      ),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const monthKeyParamSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    monthKey: z
      .string()
      .regex(monthKeyRegex, "monthKey must be in YYYY-MM format"),
  }),
  query: z.object({}).optional().default({}),
});
