const TOKEN_KEY = "fantacalcio_token";

// In sviluppo locale le richieste a "/api" passano dal proxy di Vite verso
// http://localhost:4000 (vedi vite.config.ts). In produzione (es. frontend
// su Vercel, backend su Render) non c'e' un proxy: bisogna configurare
// VITE_API_URL con l'URL completo del backend deployato (senza slash finale),
// es. https://fantacalcio-backend.onrender.com
const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  formData?: FormData;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const resp = await fetch(`${API_BASE}/api${path}`, { method: options.method ?? "GET", headers, body });

  if (resp.status === 204) return undefined as T;

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ApiError(data.error ?? "Errore di rete", resp.status);
  }
  return data as T;
}
