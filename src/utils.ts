export function getBackendUrl(): string {
  const saved = localStorage.getItem('sonicstream_backend_url');
  if (saved) {
    return saved.replace(/\/+$/, '');
  }
  return window.location.origin;
}

export function apiFetch(urlPath: string, options?: RequestInit): Promise<Response> {
  const normalizedPath = urlPath.startsWith('/') ? urlPath : '/' + urlPath;
  return fetch(`${getBackendUrl()}${normalizedPath}`, options);
}
