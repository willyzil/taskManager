let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function request(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, headers: getHeaders() });
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    
    if (res.status === 401) {
      // Token expired or invalid — clear session and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (onUnauthorized) onUnauthorized();
      return Promise.reject(new Error('Unauthorized'));
    }
    
    const error: any = new Error(body?.message || 'Request failed');
    error.status = res.status;
    throw error;
  }
  
  return res.json();
}

export const api = {
  get: (url: string) => request(url),
  post: (url: string, body: unknown) =>
    request(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: (url: string, body: unknown) =>
    request(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url: string) => request(url, { method: 'DELETE' }),
};
