export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const apiBase = import.meta.env.VITE_API_URL ?? "/api";
    const token = localStorage.getItem("sir-token");
    const response = await fetch(`${apiBase}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {})
      },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.detail ?? payload?.message ?? response.statusText;
      throw new Error(detail || `Error API ${response.status}`);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`No se pudo conectar con el backend. Verifica que esté ejecutándose.`);
    }
    throw error;
  }
}
