export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = body && typeof body.message === 'string' ? body.message : `Request failed: ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return body as T;
}
