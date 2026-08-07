import { Schedule } from '../types';

/** Nombres de día tal y como los devuelve `Date.getDay()`, en español. */
const DAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

/**
 * Variantes sin tilde: los horarios se guardan como texto libre y llegan
 * indistintamente "Miercoles" o "Miércoles".
 */
/** Quita las tildes descomponiendo y borrando las marcas diacríticas. */
function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function dayMatches(scheduleDay: string, dayName: string): boolean {
  return stripAccents(scheduleDay.toLowerCase()).includes(stripAccents(dayName));
}

/**
 * Hora de inicio de un horario. El campo admite tanto "06:30" como
 * "06:30 - 08:30", así que se toma el primer tramo.
 */
function startTime(time: string): { hours: number; minutes: number } | null {
  const match = /(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export type NextCollection = {
  schedule: Schedule;
  at: Date;
};

/**
 * Próxima recolección programada para una zona, buscando en los siete días
 * siguientes.
 *
 * Devuelve `null` si la zona no tiene horarios: es mejor no decir nada que
 * inventar una fecha.
 */
export function findNextCollection(
  schedules: Schedule[],
  zone: string | undefined,
  now: Date = new Date(),
): NextCollection | null {
  const target = String(zone ?? '')
    .trim()
    .toLowerCase();
  if (!target) return null;

  const zoneSchedules = schedules.filter(
    (item) => String(item.zone ?? '').trim().toLowerCase() === target,
  );
  if (zoneSchedules.length === 0) return null;

  // Se recorre hoy y los siete días siguientes. Ocho, no siete: si la única
  // recolección de la zona es hoy y ya ha pasado, la siguiente cae dentro de
  // una semana exacta, que es el octavo día de la ventana.
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const dayName = DAY_NAMES[day.getDay()];

    const candidates = zoneSchedules
      .filter((item) => dayMatches(String(item.day ?? ''), dayName))
      .map((item) => {
        const time = startTime(String(item.time ?? ''));
        if (!time) return null;
        const at = new Date(day);
        at.setHours(time.hours, time.minutes, 0, 0);
        return { schedule: item, at };
      })
      .filter((item): item is NextCollection => item !== null && item.at > now)
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    if (candidates.length > 0) return candidates[0];
  }

  return null;
}

/** "2 d 3 h 15 min" — se omiten las unidades que no aportan. */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return 'en curso';
  const totalMinutes = Math.floor(msRemaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} d`);
  if (hours > 0 || days > 0) parts.push(`${hours} h`);
  parts.push(`${minutes} min`);
  return parts.join(' ');
}
