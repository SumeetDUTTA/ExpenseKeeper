import ApiError from "../utils/ApiError.js";

export function validate(schema) {
    return (req, res, next) => {
        try {
            const data = { body: req.body, params: req.params, query: req.query };
            const parsed = schema.parse(data);
            
            // Only set properties that can be modified
            if (parsed.body) req.body = parsed.body;
            if (parsed.params) req.params = parsed.params;
            // Don't try to set req.query as it's read-only
            
            next();
        } catch (error) {
            if (error.name === 'ZodError' && error.issues) {
                const validationErrors = error.issues.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                return res.status(400).json({
                    success: false,
                    message: 'Validation Error',
                    errors: validationErrors
                });
            }
            // For other types of errors or if error.issues is undefined
            return res.status(400).json({
                success: false,
                message: 'Validation Error',
                error: error.message || 'Invalid request data'
            });
        }
    };
}