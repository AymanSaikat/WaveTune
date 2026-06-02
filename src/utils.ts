export function getBackendUrl(): string {
  const saved = localStorage.getItem('sonicstream_backend_url');
  if (saved) {
    return saved.replace(/\/+$/, '');
  }
  
  // Allow configure via environment variable for custom static or custom domain deployments
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // Under normal full-stack deployments (like the AI Studio container or unified cloud targets),
  // returning an empty string enables clean, relative backend API routing.
  return '';
}

export function getBackendUrlDisplay(): string {
  return getBackendUrl() || window.location.origin;
}

export function apiFetch(urlPath: string, options?: RequestInit): Promise<Response> {
  const normalizedPath = urlPath.startsWith('/') ? urlPath : '/' + urlPath;
  const backendUrl = getBackendUrl();
  const targetUrl = backendUrl ? `${backendUrl}${normalizedPath}` : normalizedPath;
  return fetch(targetUrl, options);
}
