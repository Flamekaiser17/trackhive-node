/**
 * asyncHandler.js
 * Higher-order function wrapping async Express route controllers
 * and automatically forwarding uncaught rejections to next(err).
 */
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };
export default asyncHandler;
