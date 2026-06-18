/**
 * Global Express Error Handling Middleware
 *
 * Intercepts unhandled errors across controllers and formats them as structured
 * JSON outputs, hiding internal stacks in production environments.
 */
export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(
    `[Error] ${req.method} ${req.url} - Status: ${statusCode} - Msg: ${message}`
  );
  if (err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
