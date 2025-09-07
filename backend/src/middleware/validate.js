import ApiError from "../utils/ApiError.js";

export function validate(schema) {
    return (req, res, next) => {
        try {
            const data = { body: req.body, params: req.params, query: req.query };
            const parsed = schema.parse(data);
            req.body = parsed.body;
            req.params = parsed.params;
            req.query = parsed.query;
            next();
        } catch (error) {
            next(new ApiError(400, 'Validation Error', error.errors));
        }
    };
}