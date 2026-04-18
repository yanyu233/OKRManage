export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

export function resolveApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(resolveApiUrl(path), {
    credentials: 'include',
    headers,
    ...init
  });

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = extractApiErrorMessage(body, response.status);
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export async function apiRequestBlob(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? {});
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(resolveApiUrl(path), {
    credentials: 'include',
    headers,
    ...init
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const body = await response.json();
      message = extractApiErrorMessage(body, response.status);
    } catch {
      // ignore non-json bodies
    }

    throw new ApiError(message, response.status);
  }

  return {
    blob: await response.blob(),
    headers: response.headers
  };
}

function extractApiErrorMessage(body: unknown, status: number) {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    if (Array.isArray(message)) {
      const text = message
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .join('\n');

      if (text) {
        return text;
      }
    }
  }

  return `Request failed: ${status}`;
}
