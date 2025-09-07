import z from "zod";

const createExpenseSchema = z.object({
    body: z.object({
        amount: z.number().positive(),
        category: z.enum([
            'Food', 'Transport', 'Utilities',
            'Entertainment', 'Healthcare', "Clothing",
            'Education', 'Pets', 'Personal Care',
            'Gifts & Donations', 'Housing', 'Other'
        ]),
        date: z.coerce.date().optional(),
        note: z.string().max(500).optional().default(''),
    }),
    params: z.object({}).optional().default({}),
    query: z.object({}).optional().default({}),
});

const updateExpenseSchema = z.object({
    body: z.object({
        amount: z.number().positive().optional(),
        category: z.enum([
            'Food', 'Transport', 'Utilities',
            'Entertainment', 'Healthcare', "Clothing",
            'Education', 'Pets', 'Personal Care',
            'Gifts & Donations', 'Housing', 'Other'
        ]),
        date: z.coerce.date().optional(),
        note: z.string().max(500).optional(),
    }),
    params: z.object({
        id: z.string().length(24, "Invalid MongoDB ObjectId"),
    }),
    query: z.object({}).optional().default({}),
});

const idParamSchema = z.object({
    body: z.object({}).optional().default({}),
    params: z.object({
        id: z.string().length(24, 'Invalid MongoDB ObjectId'),
    }),
    query: z.object({}).optional().default({}),
});

export { createExpenseSchema, updateExpenseSchema, idParamSchema }