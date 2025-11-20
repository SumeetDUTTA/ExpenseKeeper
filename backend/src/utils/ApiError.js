class ApiError extends Error {
  constructor(message, status = 500, extra = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;           // used by error handler
    this.statusCode = status;       // sometimes used elsewhere
    this.extra = extra;             // optional payload
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;