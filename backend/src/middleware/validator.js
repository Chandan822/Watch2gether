/**
 * Zod Request Body Validation Middleware
 * 
 * Reusable middleware that checks incoming request bodies against a Zod schema,
 * sanitizing values and returning structured 400 validation reports on failures.
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Request body validation failed',
      errors: result.error.format(),
    });
  }
  
  // Replace request body with validated and parsed data
  req.body = result.data;
  next();
};

export default validateBody;
