import z from 'zod';

const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6).max(100).and({
            required: true,
            regx: /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/,
            message: "Password must be at least 6 characters long and contain at least one capital letter and one number and one special character"
        })
    }),
    params: z.object({}).optional().default({}),
    query: z.object({}).optional().default({}),
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(6).max(100).and({
            required: true,
            regx: /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/,
            message: "Password must be at least 6 characters long and contain at least one capital letter and one number and one special character"
        })
    }),
    params: z.object({}).optional().default({}),
    query: z.object({}).optional().default({}),
});

export { registerSchema, loginSchema };