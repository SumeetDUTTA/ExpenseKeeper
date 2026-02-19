import z from "zod";

const timezoneSchema = z.string().refine((value) => {
    try {
        Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
        return true;
    } catch {
        return false;
    }
}, {
    message: "Invalid timezone"
});

const createExpenseSchema = z.object({
    body: z.object({
        amount: z.number().positive(),
        category: z.string().refine((val) => {
            const validCategories = [
                'Food & Drink',
                'Travel',
                'Utilities',
                'Entertainment',
                'Health & Fitness',
                'Shopping',
                'Rent',
                'Other',
                'Salary',
                'Investment',
                'Clothing',
                'Education',
                'Personal Care'
            ];
            
            // Backward compatibility mapping
            const categoryMapping = {
                'Food': 'Food & Drink',
                'Transport': 'Travel',
                'Healthcare': 'Health & Fitness',
                'Housing': 'Rent'
            };
            
            const trimmedVal = val.trim();
            
            // Check if it's a valid new category or a mappable old category
            const isValidNew = validCategories.includes(trimmedVal);
            const isValidOld = categoryMapping.hasOwnProperty(trimmedVal);
            
            return isValidNew || isValidOld;
        }, {
            message: `Invalid category. Must be one of: ${[
                'Food & Drink',
                'Travel',
                'Utilities',
                'Entertainment',
                'Health & Fitness',
                'Shopping',
                'Rent',
                'Other',
                'Salary',
                'Investment',
                'Clothing',
                'Education',
                'Personal Care'
            ].join(', ')} (or legacy names: Food, Transport, Healthcare, Housing)`
        }).transform((val) => {
            const categoryMapping = {
                'Food': 'Food & Drink',
                'Transport': 'Travel',
                'Healthcare': 'Health & Fitness',
                'Housing': 'Rent'
            };
            
            const trimmedVal = val.trim();
            // Map old category names to new ones
            return categoryMapping[trimmedVal] || trimmedVal;
        }),
        date: z.coerce.date().optional(),
        note: z.string().max(500).optional().default(''),
        budgetItemId: z.string().length(24, "Invalid budget item id").optional(),
        timezone: timezoneSchema.optional(),
    }),
    params: z.object({}).optional().default({}),
    query: z.object({}).optional().default({}),
});

const updateExpenseSchema = z.object({
    body: z.object({
        amount: z.number().positive().optional(),
        category: z.string().refine((val) => {
            const validCategories = [
                'Food & Drink',
                'Travel',
                'Utilities',
                'Entertainment',
                'Health & Fitness',
                'Shopping',
                'Rent',
                'Other',
                'Salary',
                'Investment',
                'Clothing',
                'Education',
                'Personal Care'
            ];
            
            // Backward compatibility mapping
            const categoryMapping = {
                'Food': 'Food & Drink',
                'Transport': 'Travel',
                'Healthcare': 'Health & Fitness',
                'Housing': 'Rent'
            };
            
            const trimmedVal = val.trim();
            
            // Check if it's a valid new category or a mappable old category
            const isValidNew = validCategories.includes(trimmedVal);
            const isValidOld = categoryMapping.hasOwnProperty(trimmedVal);
            
            return isValidNew || isValidOld;
        }, {
            message: `Invalid category. Must be one of: ${[
                'Food & Drink',
                'Travel',
                'Utilities',
                'Entertainment',
                'Health & Fitness',
                'Shopping',
                'Rent',
                'Other',
                'Salary',
                'Investment',
                'Clothing',
                'Education',
                'Personal Care'
            ].join(', ')} (or legacy names: Food, Transport, Healthcare, Housing)`
        }).transform((val) => {
            const categoryMapping = {
                'Food': 'Food & Drink',
                'Transport': 'Travel',
                'Healthcare': 'Health & Fitness',
                'Housing': 'Rent'
            };
            
            const trimmedVal = val.trim();
            // Map old category names to new ones
            return categoryMapping[trimmedVal] || trimmedVal;
        }).optional(),
        date: z.coerce.date().optional(),
        note: z.string().max(500).optional(),
        budgetItemId: z.union([
            z.string().length(24, "Invalid budget item id"),
            z.literal(null),
            z.literal('')
        ]).optional(),
        timezone: timezoneSchema.optional(),
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