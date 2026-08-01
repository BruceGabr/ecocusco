export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const apiBase = import.meta.env.VITE_API_URL ?? "/api";
    const token = localStorage.getItem("sir-token");
    // `headers` se extrae de options: si se dejara dentro del spread posterior,
    // sobrescribiría el objeto ya combinado y se perderían Content-Type y Authorization.
    const { headers: optionHeaders, ...restOptions } = options;
    const response = await fetch(`${apiBase}${path}`, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(optionHeaders ?? {})
      }
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
