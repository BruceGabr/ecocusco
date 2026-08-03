/**
 * Mock de Leaflet para las pruebas.
 *
 * jsdom no dibuja mapas, así que las vistas que montan `MapView` solo necesitan
 * que la API de Leaflet exista y no reviente. Antes cada archivo de test se
 * fabricaba su propia versión de este mock, todas incompletas y ligeramente
 * distintas: al configurar los iconos por defecto en `MapView`, dos suites
 * dejaron de arrancar porque a su mock le faltaba `Icon.Default`.
 *
 * Uso:
 *   vi.mock('leaflet', () => import('./test-utils/leaflet-mock'));
 */

/** Capa encadenable: todos sus métodos se devuelven a sí misma. */
function createLayer() {
  const layer = {
    addTo: () => layer,
    bindPopup: () => layer,
    addLayer: () => layer,
    remove: () => {},
  };
  return layer;
}

function createMap() {
  const map = {
    setView: () => map,
    addLayer: () => map,
    remove: () => {},
  };
  return map;
}

type IconOptions = Record<string, unknown>;

/**
 * Réplica mínima de `L.Icon.Default`.
 *
 * Reproduce el prefijo que el Leaflet real antepone en `_getIconUrl`, para que
 * el mock se comporte igual cuando `MapView` elimina ese método.
 */
interface IconDefaultPrototype {
  options: IconOptions;
  _getIconUrl?(name: string): string;
  createIcon(): HTMLImageElement;
}

const iconDefaultPrototype: IconDefaultPrototype = {
  options: {},
  _getIconUrl(name: string) {
    return `mock-image-path/${this.options[`${name}Url`]}`;
  },
  createIcon() {
    const image = document.createElement('img');
    const url = this._getIconUrl
      ? this._getIconUrl('icon')
      : String(this.options.iconUrl);
    image.setAttribute('src', String(url));
    return image;
  },
};

// Objeto plano en vez de clase: `MapView` solo necesita `prototype` para
// eliminar `_getIconUrl` y `mergeOptions` para fijar las URLs. Declararlo como
// clase chocaría con `Function.prototype`.
const IconDefault = {
  prototype: iconDefaultPrototype,
  mergeOptions(options: IconOptions) {
    Object.assign(iconDefaultPrototype.options, options);
  },
};

const leaflet = {
  map: createMap,
  tileLayer: createLayer,
  layerGroup: createLayer,
  marker: createLayer,
  circleMarker: createLayer,
  circle: createLayer,
  icon: () => ({}),
  Icon: { Default: IconDefault },
  Browser: { retina: false },
};

export default leaflet;
