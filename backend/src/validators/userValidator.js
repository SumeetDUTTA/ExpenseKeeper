import { z } from 'zod';

export const updateUserSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name must be a non-empty string').optional(),
        email: z.string().email({ message: 'Invalid email format' }).optional(),
        currentPassword: z.string().optional(),
        password: z.string()
            .min(6, 'New password must be at least 6 characters')
            .max(100, 'New password must be less than 100 characters')
            .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/,
                "Password must contain at least one uppercase letter, one number, and one special character")
            .optional(),
        monthlyBudget: z.number().min(0, 'Monthly budget must be a positive number').optional(),
        userType: z.enum([
            'college_student',
            'young_professional',
            'family_moderate',
            'family_high',
            'luxury_lifestyle',
            'senior_retired'
        ]).optional()
    })
})

// Validation schema for updating user metadata
export const updateUserMetaSchema = z.object({
    body: z.object({
        monthlyBudget: z.number()
            .min(0, 'Monthly budget must be a positive number')
            .max(1000000, 'Monthly budget seems too high')
            .optional(),
        userType: z.enum([
            'college_student',
            'young_professional',
            'family_moderate',
            'family_high',
            'luxury_lifestyle',
            'senior_retired'
        ]).optional(),
        firstName: z.string()
            .min(1, 'First name is required')
            .max(50, 'First name too long')
            .optional(),
        lastName: z.string()
            .min(1, 'Last name is required')
            .max(50, 'Last name too long')
            .optional()
    }).refine(data => Object.keys(data).length > 0, {
        message: "At least one field must be provided for update"
    })
});