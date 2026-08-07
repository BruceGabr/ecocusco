import { describe, expect, it } from 'vitest';
import { findNextCollection, formatCountdown } from './nextCollection';
import { Schedule } from '../types';

const schedule = (id: number, zone: string, day: string, time: string): Schedule => ({
  id,
  zone,
  day,
  time,
  waste: 'Orgánico',
});

// Jueves 6 de agosto de 2026, 10:00 hora local.
const JUEVES_10H = new Date(2026, 7, 6, 10, 0, 0);

describe('findNextCollection', () => {
  it('devuelve null cuando el usuario no tiene zona', () => {
    const schedules = [schedule(1, 'Wanchaq', 'Jueves', '18:00')];
    expect(findNextCollection(schedules, undefined, JUEVES_10H)).toBeNull();
  });

  it('devuelve null cuando la zona no tiene horarios', () => {
    const schedules = [schedule(1, 'Wanchaq', 'Jueves', '18:00')];
    expect(findNextCollection(schedules, 'Santiago', JUEVES_10H)).toBeNull();
  });

  it('encuentra la recolección de hoy si todavía no ha pasado', () => {
    const schedules = [schedule(1, 'Wanchaq', 'Jueves', '18:00')];
    const next = findNextCollection(schedules, 'Wanchaq', JUEVES_10H);
    expect(next?.at.getDate()).toBe(6);
    expect(next?.at.getHours()).toBe(18);
  });

  it('salta a la siguiente semana si la de hoy ya pasó', () => {
    const schedules = [schedule(1, 'Wanchaq', 'Jueves', '08:00')];
    const next = findNextCollection(schedules, 'Wanchaq', JUEVES_10H);
    expect(next?.at.getDate()).toBe(13);
  });

  it('elige la más próxima entre varios días', () => {
    const schedules = [
      schedule(1, 'Wanchaq', 'Domingo', '07:00'),
      schedule(2, 'Wanchaq', 'Viernes', '06:30'),
    ];
    const next = findNextCollection(schedules, 'Wanchaq', JUEVES_10H);
    expect(next?.schedule.id).toBe(2);
  });

  it('reconoce el día aunque el horario venga sin tilde', () => {
    // Los horarios se guardan como texto libre: "Miercoles" y "Miércoles"
    // conviven en los datos.
    const miercoles = new Date(2026, 7, 5, 6, 0, 0);
    const schedules = [schedule(1, 'Wanchaq', 'Miercoles y sabado', '08:00')];
    expect(findNextCollection(schedules, 'Wanchaq', miercoles)?.at.getDate()).toBe(5);
  });

  it('acepta horarios expresados como rango y usa la hora de inicio', () => {
    const schedules = [schedule(1, 'Wanchaq', 'Jueves', '18:30 - 20:30')];
    expect(findNextCollection(schedules, 'Wanchaq', JUEVES_10H)?.at.getHours()).toBe(18);
  });

  it('compara la zona sin distinguir mayúsculas ni espacios', () => {
    const schedules = [schedule(1, 'Wanchaq', 'Jueves', '18:00')];
    expect(findNextCollection(schedules, '  wanchaq ', JUEVES_10H)).not.toBeNull();
  });
});

describe('formatCountdown', () => {
  it('omite las unidades que no aportan', () => {
    expect(formatCountdown(45 * 60_000)).toBe('45 min');
    expect(formatCountdown(3 * 3_600_000 + 5 * 60_000)).toBe('3 h 5 min');
    expect(formatCountdown(26 * 3_600_000)).toBe('1 d 2 h 0 min');
  });

  it('avisa cuando la recolección ya empezó', () => {
    expect(formatCountdown(-1)).toBe('en curso');
  });
});
