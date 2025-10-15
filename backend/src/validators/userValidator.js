import { z } from 'zod';

// Validation schema for updating user metadata
export const updateUserMetaSchema = z.object({
    body: z.object({
        monthlyBudget: z.number()
            .min(0, 'Monthly budget must be a positive number')
            .max(1000000, 'Monthly budget seems too high')
            .optional(),
        user_type: z.enum([
            'college_student', 
            'working_professional', 
            'family_oriented', 
            'high_earner', 
            'budget_conscious', 
            'social_spender'
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