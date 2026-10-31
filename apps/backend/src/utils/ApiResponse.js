/**
 * ApiResponse.js
 * Standardized API response wrapper aligned with VidVore production patterns.
 */
class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {any} data - Response payload
   * @param {string} message - Response message
   */
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

export { ApiResponse };
export default ApiResponse;

