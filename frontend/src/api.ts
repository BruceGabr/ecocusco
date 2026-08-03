/** Error de la API que conserva el código HTTP para poder reaccionar a él. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  /** La sesión no vale: token ausente, caducado o firmado con otra clave. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** Código que usamos cuando la petición ni siquiera llegó a salir. */
const NETWORK_ERROR_STATUS = 0;

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiBase = import.meta.env.VITE_API_URL ?? '/api';
  const token = localStorage.getItem('sir-token');
  // `headers` se extrae de options: si se dejara dentro del spread posterior,
  // sobrescribiría el objeto ya combinado y se perderían Content-Type y Authorization.
  const { headers: optionHeaders, ...restOptions } = options;

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(optionHeaders ?? {}),
      },
    });
  } catch (error) {
    // fetch solo rechaza por fallo de red; los errores HTTP llegan resueltos.
    throw new ApiError(
      'No se pudo conectar con el backend. Verifica que esté ejecutándose.',
      NETWORK_ERROR_STATUS,
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail ?? payload?.message ?? response.statusText;
    throw new ApiError(detail || `Error API ${response.status}`, response.status);
  }
  return payload as T;
}
