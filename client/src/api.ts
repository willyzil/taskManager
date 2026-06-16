const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function request(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, headers: getHeaders() });
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
