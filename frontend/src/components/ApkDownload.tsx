import React from "react";
import { Icon } from "./Icon";
import { APK_URL, APK_VERSION } from "../constants";

/**
 * Descarga de la app móvil desde la pantalla de acceso.
 *
 * Está aquí y no dentro de la aplicación porque el destinatario es alguien que
 * todavía no ha entrado: el vecino que llega a la web buscando cuándo pasa el
 * camión y a quien le sirve más el móvil.
 *
 * Si no hay APK publicado todavía, el bloque no se renderiza: un enlace roto
 * es peor que ningún enlace.
 */
export function ApkDownload() {
  if (!APK_URL) return null;

  return (
    <div className="apk-download">
      <div className="apk-icon" aria-hidden="true">
        <Icon name="truck" />
      </div>
      <div className="apk-copy">
        <strong>Descarga la app para Android</strong>
        <span>
          Recibe un aviso en tu celular cuando el camión esté a dos cuadras de tu casa, aunque
          tengas la app cerrada.
        </span>
      </div>
      <a
        className="btn primary apk-button"
        href={APK_URL}
        download
        target="_blank"
        rel="noreferrer"
      >
        <Icon name="download" /> Descargar APK
        {APK_VERSION ? <span className="apk-version">v{APK_VERSION}</span> : null}
      </a>
    </div>
  );
}

export default ApkDownload;
