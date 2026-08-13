const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function apiRequest(path, options = {}) {
  const { headers, ...requestOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...(requestOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...requestOptions,
  });

  if (!response.ok) {
    let serverMessage;
    let serverCode;
    try {
      const body = await response.json();
      serverMessage = body.message;
      serverCode = body.code; // ApiError phía server luôn kèm code (vd AUTH_ACCESS_REVOKED)
    } catch {
      /* response không phải JSON */
    }
    const err = new Error(serverMessage || `Lỗi máy chủ (${response.status})`);
    err.status = response.status;
    err.code = serverCode;
    throw err;
  }

  return response.status === 204 ? null : response.json();
}

export { API_BASE_URL };