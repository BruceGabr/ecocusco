import React, { FormEvent, useMemo, useState } from 'react';
import { Bootstrap, Monitor, Report, Session } from '../types';
import { Icon, IconName } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { Panel } from '../components/Panel';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { DataTable, Column } from '../components/DataTable';
import { Toolbar, FilterSelect } from '../components/Toolbar';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { formatTimeLabel } from '../components/TimePicker';
import { toOptions } from '../constants';

type WasteType = {
  name: string;
  desc: string;
  bin: string;
  icon: IconName;
  color: string;
};

/**
 * Guía de contenedores. Es referencia del dominio (qué va en cada tacho), no
 * datos de la operación: por eso vive en el frontend y no cambia sola.
 */
const wasteTypes: WasteType[] = [
  { name: 'Orgánicos', desc: 'Restos de comida, cáscaras, hojas y residuos biodegradables.', bin: 'Verde', icon: 'leaf', color: 'green' },
  { name: 'Plástico', desc: 'Botellas, envases y bolsas de plástico limpio.', bin: 'Azul', icon: 'plastic', color: 'blue' },
  { name: 'Vidrio', desc: 'Botellas y frascos de vidrio.', bin: 'Amarillo', icon: 'glass', color: 'yellow' },
  { name: 'Papel', desc: 'Papel, cartón y periódicos.', bin: 'Blanco', icon: 'paper', color: 'white' },
  { name: 'No reciclables', desc: 'Tecnopor contaminado, colillas y residuos sanitarios.', bin: 'Gris', icon: 'trash', color: 'sage' },
];

/**
 * Separa el texto libre de `schedule.waste` en tipos sueltos.
 *
 * En los horarios llega como "Organico y reciclable" o "No reciclable y
 * reciclable". Partir solo por "y" rompía "No reciclable" en "No" y
 * "reciclable", y aparecía un tipo llamado "No" en las estadísticas.
 */
export function extractWasteTypes(waste: string): string[] {
  if (!waste) return [];
  return waste
    .split(/\s*[,;]\s*|\s+(?:y|e|&)\s+/i)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.charAt(0).toUpperCase() + item.slice(1));
}

type Container = NonNullable<Bootstrap['containers']>[number];

export function Waste({
  data,
  monitor,
  session,
  onCreateReport,
}: {
  data: Bootstrap;
  monitor: Monitor;
  session: Session;
  onCreateReport?: (report: Omit<Report, 'id' | 'status'>) => Promise<void>;
}) {
  const schedules = data.schedules ?? [];
  const containers = monitor.containers ?? data.containers ?? [];
  const zones = data.zones ?? [];
  const isCitizen = session.role === 'ciudadano';

  const [zoneFilter, setZoneFilter] = useState('');
  const [wasteFilter, setWasteFilter] = useState('');

  const zoneNameById = useMemo(() => {
    const map: Record<number, string> = {};
    zones.forEach(zone => { map[zone.id] = zone.name; });
    return map;
  }, [zones]);

  const wasteOptions = useMemo(() => {
    const types = new Set<string>();
    schedules.forEach(item => extractWasteTypes(item.waste).forEach(type => types.add(type)));
    return toOptions([...types].sort());
  }, [schedules]);

  const zoneOptions = useMemo(
    () => toOptions([...new Set(schedules.map(item => item.zone))].sort()),
    [schedules]
  );

  // Un ciudadano ve la guía de su zona; el resto puede filtrar libremente.
  const visibleSchedules = useMemo(() => {
    const base = isCitizen
      ? schedules.filter(item => item.zone.trim().toLowerCase() === String(session.zone ?? '').trim().toLowerCase())
      : schedules;
    return base.filter(item => {
      const matchesZone = !zoneFilter || item.zone === zoneFilter;
      const matchesWaste = !wasteFilter || extractWasteTypes(item.waste).includes(wasteFilter);
      return matchesZone && matchesWaste;
    });
  }, [schedules, isCitizen, session.zone, zoneFilter, wasteFilter]);

  const containerStats = useMemo(() => {
    const total = containers.length;
    const full = containers.filter(item => String(item.status).trim().toLowerCase() === 'lleno').length;
    const averageFill = total
      ? Math.round(containers.reduce((sum, item) => sum + (Number(item.fill_level) || 0), 0) / total)
      : 0;
    return { total, full, averageFill };
  }, [containers]);

  const guideColumns: Column<(typeof schedules)[number]>[] = [
    { key: 'zone', header: 'Zona', render: item => <strong>{item.zone}</strong> },
    { key: 'day', header: 'Día', render: item => item.day },
    { key: 'time', header: 'Horario', render: item => formatTimeLabel(item.time) },
    {
      key: 'waste',
      header: 'Residuos aceptados',
      render: item => (
        <div className="tag-row">
          {extractWasteTypes(item.waste).map(type => (
            <span className="badge neutral" key={type}>{type}</span>
          ))}
        </div>
      ),
    },
  ];

  const containerColumns: Column<Container>[] = [
    { key: 'name', header: 'Contenedor', render: item => <strong>{item.name}</strong> },
    { key: 'zone', header: 'Zona', render: item => zoneNameById[item.zone_id] ?? '—' },
    {
      key: 'fill',
      header: 'Llenado',
      render: item => (
        <div className="fill-cell">
          <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${Math.min(100, Number(item.fill_level) || 0)}%` }} /></div>
          <span>{Number(item.fill_level) || 0}%</span>
        </div>
      ),
    },
    { key: 'status', header: 'Estado', render: item => <StatusBadge status={item.status} /> },
  ];

  return (
    <div className="waste-dashboard">
      <div className="metrics-grid">
        <MetricCard icon={<Icon name="map" />} tone="green" value={new Set(schedules.map(item => item.zone)).size} label="Zonas con clasificación" />
        <MetricCard icon={<Icon name="recycle" />} tone="sage" value={wasteOptions.length} label="Tipos de residuo" />
        <MetricCard icon={<Icon name="waste" />} tone="sage" value={containerStats.total} label="Contenedores monitoreados" />
        <MetricCard icon={<Icon name="alert" />} tone="mustard" value={containerStats.full} label="Contenedores llenos" />
        <MetricCard icon={<Icon name="dashboard" />} tone="green" value={`${containerStats.averageFill}%`} label="Llenado promedio" />
      </div>

      <Panel title="Guía de contenedores">
        <div className="waste-grid">
          {wasteTypes.map(type => (
            <div className="waste-card" key={type.name}>
              <div className={`waste-icon ${type.color}`}>
                <Icon name={type.icon} />
              </div>
              <h3>{type.name}</h3>
              <p>{type.desc}</p>
              <span className="bin-label">Contenedor {type.bin}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title={isCitizen ? `Qué se recoge en ${session.zone || 'tu zona'}` : 'Clasificación por zona'}
        actions={onCreateReport ? <ClassificationReport session={session} zones={zones} onCreateReport={onCreateReport} /> : undefined}
      >
        {!isCitizen && (
          <Toolbar
            filters={
              <>
                <FilterSelect label="Zona" value={zoneFilter} onChange={setZoneFilter} options={zoneOptions} allLabel="Todas" />
                <FilterSelect label="Tipo de residuo" value={wasteFilter} onChange={setWasteFilter} options={wasteOptions} allLabel="Todos" />
              </>
            }
          />
        )}
        <DataTable
          columns={guideColumns}
          rows={visibleSchedules}
          rowKey={item => item.id}
          caption="Clasificación de residuos por zona y horario"
          emptyMessage={isCitizen ? 'Aún no hay un horario de clasificación asignado a tu zona.' : 'No hay horarios que coincidan con el filtro.'}
        />
      </Panel>

      <Panel title="Estado de contenedores">
        {containers.length === 0 ? (
          <EmptyState message="No hay contenedores monitoreados." />
        ) : (
          <DataTable
            columns={containerColumns}
            rows={containers}
            rowKey={item => item.id}
            caption="Nivel de llenado de los contenedores"
          />
        )}
      </Panel>
    </div>
  );
}

/**
 * Aviso de que la clasificación de una zona no se está respetando.
 *
 * Reutiliza el flujo de reportes en vez de abrir un canal aparte: entra en el
 * mismo listado que ve el equipo municipal y se resuelve igual.
 */
function ClassificationReport({
  session,
  zones,
  onCreateReport,
}: {
  session: Session;
  zones: Bootstrap['zones'];
  onCreateReport: (report: Omit<Report, 'id' | 'status'>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [zone, setZone] = useState(session.zone ?? '');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!zone || detail.trim().length < 8) {
      setError('Indica la zona y describe el problema con al menos 8 caracteres.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onCreateReport({ citizen: session.name, zone, type: 'Otro', detail: detail.trim() });
      setDetail('');
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar el reporte');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" className="action-btn" onClick={() => setOpen(true)}>
        <Icon name="alert" /> Reportar problema
      </button>
      <Modal open={open} title="Reportar problema de clasificación" onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit} noValidate>
          <label htmlFor="classification-zone">Zona
            <Select
              id="classification-zone"
              value={zone}
              onChange={setZone}
              options={zones.map(item => ({ value: item.name, label: item.name }))}
              placeholder="Selecciona una zona"
            />
          </label>
          <label className="wide" htmlFor="classification-detail">Detalle
            <textarea
              id="classification-detail"
              required
              minLength={8}
              maxLength={600}
              value={detail}
              placeholder="Ej. el contenedor de orgánicos recibe plástico"
              onChange={event => setDetail(event.currentTarget.value)}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar reporte'}
            </button>
          </div>
        </form>
        {error && <p className="hint error" role="alert">{error}</p>}
      </Modal>
    </>
  );
}

export default Waste;
