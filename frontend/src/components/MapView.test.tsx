import { describe, expect, it } from 'vitest';
import L from 'leaflet';

// Importar el componente aplica la configuración de iconos como efecto de módulo.
import './MapView';

/**
 * Los iconos de marcador de Leaflet se pedían a la raíz del sitio
 * (/marker-icon.png), que en el despliegue no existe: en producción daban 404
 * y las zonas salían sin marcador.
 *
 * Hay dos partes que deben cumplirse a la vez. Si solo se hace `mergeOptions`,
 * `Icon.Default._getIconUrl` antepone la ruta que autodetecta de la hoja de
 * estilos y vuelve a romper las URLs.
 */
describe('iconos por defecto de Leaflet', () => {
  it('no delega en la resolución de rutas de Icon.Default', () => {
    expect(
      Object.prototype.hasOwnProperty.call(L.Icon.Default.prototype, '_getIconUrl'),
    ).toBe(false);
  });

  it('apunta a recursos del bundle y no a la raíz del sitio', () => {
    const { iconUrl, iconRetinaUrl, shadowUrl } = L.Icon.Default.prototype.options;

    for (const url of [iconUrl, iconRetinaUrl, shadowUrl]) {
      expect(url, 'la opción debe estar definida').toBeTruthy();
      expect(
        url,
        `"${url}" es un nombre suelto: el navegador lo pediría a la raíz del sitio`,
      ).not.toMatch(/^marker-/);
    }
  });

  it('resuelve la URL final sin prefijos añadidos', () => {
    const resolved = new L.Icon.Default().createIcon() as HTMLImageElement;
    const expected = L.Browser.retina
      ? L.Icon.Default.prototype.options.iconRetinaUrl
      : L.Icon.Default.prototype.options.iconUrl;

    expect(resolved.getAttribute('src')).toBe(expected);
  });
});
