export function getBackendUrl(): string {
  const saved = localStorage.getItem('sonicstream_backend_url');
  if (saved) {
    return saved.replace(/\/+$/, '');
  }
  const hostname = window.location.hostname;
  if (hostname.endsWith('.github.io') || (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.run.app'))) {
    return 'https://ais-pre-ghbownajglsozvqeylynw7-256061441880.asia-southeast1.run.app';
  }
  return window.location.origin;
}

export function apiFetch(urlPath: string, options?: RequestInit): Promise<Response> {
  const normalizedPath = urlPath.startsWith('/') ? urlPath : '/' + urlPath;
  return fetch(`${getBackendUrl()}${normalizedPath}`, options);
}
