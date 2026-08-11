/** Bọc async route handler — tránh try/catch lặp trong controller mỏng */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
