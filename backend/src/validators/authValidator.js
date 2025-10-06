import z from 'zod';

const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
        email: z.string().email("Please provide a valid email address"),
        password: z.string()
            .min(6, "Password must be at least 6 characters long")
            .max(100, "Password must be less than 100 characters")
            .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/, 
                "Password must contain at least one uppercase letter, one number, and one special character")
    }),
    params: z.object({}).optional().default({}),
    query: z.object({}).optional().default({}),
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Please provide a valid email address"),
        password: z.string()
            .min(6, "Password must be at least 6 characters long")
            .max(100, "Password must be less than 100 characters")
    }),
    params: z.object({}).optional().default({}),
    query: z.object({}).optional().default({}),
});

export { registerSchema, loginSchema };