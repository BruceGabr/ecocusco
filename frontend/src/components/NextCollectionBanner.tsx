import React, { useEffect, useMemo, useState } from "react";
import { Schedule } from "../types";
import { Icon } from "./Icon";
import { formatTimeLabel } from "./TimePicker";
import { findNextCollection, formatCountdown } from "../utils/nextCollection";

/** Cada cuánto se recalcula la cuenta atrás, en ms. */
const TICK_MS = 30_000;

/**
 * Aviso de la próxima recolección en la zona del usuario.
 *
 * Un ciudadano entra a Horarios para responder una pregunta: cuándo pasa el
 * camión por su calle. La tabla completa obligaba a buscarlo entre todas las
 * zonas.
 *
 * Se refresca cada 30 segundos, no cada segundo: la cuenta se muestra en
 * minutos, así que un tick por segundo solo gastaría renders.
 */
export function NextCollectionBanner({
  schedules,
  zone,
}: {
  schedules: Schedule[];
  zone?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  const next = useMemo(() => findNextCollection(schedules, zone, now), [schedules, zone, now]);

  if (!zone || !next) return null;

  return (
    <div className="next-collection">
      <Icon name="schedules" />
      <div className="next-collection-body">
        <strong>Próxima recolección en {zone}</strong>
        <span>
          {next.schedule.day} · {formatTimeLabel(next.schedule.time)} · {next.schedule.waste}
        </span>
      </div>
      <span className="next-collection-countdown">
        {formatCountdown(next.at.getTime() - now.getTime())}
      </span>
    </div>
  );
}

export default NextCollectionBanner;
