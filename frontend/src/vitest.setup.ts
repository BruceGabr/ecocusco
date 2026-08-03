import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

/**
 * Polyfill de Web Storage para el entorno de pruebas.
 *
 * El entorno jsdom de Vitest 4 declara `localStorage` en `window` pero deja su
 * valor en `undefined`, así que cualquier test que toque la sesión revienta con
 * "Cannot read properties of undefined". Antes cada archivo de test se fabricaba
 * su propio mock (y el que no lo hacía, fallaba); definirlo una sola vez aquí
 * mantiene el comportamiento consistente en toda la suite.
 */
function createStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const storage = createStorage();
  for (const target of [globalThis, globalThis.window].filter(Boolean)) {
    Object.defineProperty(target, name, {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

/**
 * `matchMedia` no existe en jsdom y `main.tsx` lo consulta al inicializar el
 * tema. Se registra aquí para que ningún test tenga que recordarlo.
 */
if (typeof globalThis.window !== 'undefined' && !globalThis.window.matchMedia) {
  Object.defineProperty(globalThis.window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Cada test arranca sin sesión heredada del anterior.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
