import z from "zod";

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const timezoneSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((value) => {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone")
  .optional();

const budgetItemInputSchema = z.object({
  id: z.string().length(24, "Invalid budget item id").optional(),
  name: z.string().trim().min(1, "Budget name is required").max(80),
  allocated: z.number().min(0, "Budget allocation must be non-negative"),
});

const monthQuerySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    month: z.string().regex(monthRegex, "Month must be YYYY-MM").optional(),
    timezone: timezoneSchema,
  }).optional().default({}),
});

const upsertMonthBudgetSchema = z.object({
  body: z.object({
    month: z.string().regex(monthRegex, "Month must be YYYY-MM").optional(),
    timezone: timezoneSchema,
    items: z.array(budgetItemInputSchema).default([]),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export { monthQuerySchema, upsertMonthBudgetSchema };