import { ApiError } from '../utils/ApiError.js';

/**
 * error.middleware.js
 * Global Express error handling middleware aligned with VidVore production patterns.
 * Catches ApiError and Prisma errors, returning structured responses without crashing.
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    let statusCode = 500;
    let message = error.message || 'Internal Server Error';

    // Handle Prisma Specific Exception Codes
    if (error.name === 'PrismaClientKnownRequestError') {
      statusCode = 400;
      if (error.code === 'P2002') {
        message = `Unique constraint failed on field(s): ${error.meta?.target || 'unknown'}`;
      } else if (error.code === 'P2025') {
        statusCode = 404;
        message = 'Requested record was not found in the database';
      } else {
        message = `Database query error [${error.code}]`;
      }
    } else if (error.name === 'PrismaClientValidationError') {
      statusCode = 400;
      message = 'Database schema validation failed for input payload';
    }

    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  const response = {
    statusCode: error.statusCode,
    success: false,
    message: error.message,
    errors: error.errors || [],
    ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  };

  // Structured logging for 5xx server faults
  if (error.statusCode >= 500) {
    console.error(`[UnhandledError] ${req.method} ${req.originalUrl}:`, error.message);
  }

  return res.status(error.statusCode).json(response);
};

export default errorHandler;

