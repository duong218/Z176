export class ApiError extends Error {
  constructor(statusCode, message, code = 'API_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function assertFound(doc, message = 'Không tìm thấy', code = 'NOT_FOUND') {
  if (!doc) {
    throw new ApiError(404, message, code);
  }
  return doc;
}
