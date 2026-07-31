import React from "react";
import { Bootstrap, OperationUpdatePayload, Session } from "../types";
import { UserPanel } from "./admin/UserPanel";
import { ZonePanel } from "./admin/ZonePanel";
import { SchedulePanel } from "./admin/SchedulePanel";
import { TruckPanel } from "./admin/TruckPanel";
import { MaintenancePanel } from "./admin/MaintenancePanel";
import { EventsPanel } from "./admin/EventsPanel";

export default function Admin({ data, session, onResolveReport, onOperationUpdate }: { data: Bootstrap; session: Session; onResolveReport: (id: number) => Promise<void>; onOperationUpdate: (payload: OperationUpdatePayload) => Promise<void>; }) {
  void session;
  void onResolveReport;

  return (
    <div className="two-col">
      <UserPanel users={data.users ?? []} />
      <ZonePanel zones={data.zones ?? []} />
      <SchedulePanel zones={data.zones ?? []} schedules={data.schedules ?? []} />
      <TruckPanel zones={data.zones ?? []} trucks={data.trucks ?? []} />
      <MaintenancePanel trucks={data.trucks ?? []} maintenance={data.maintenance ?? []} />
      <EventsPanel routes={data.routes ?? []} containers={data.containers ?? []} onOperationUpdate={onOperationUpdate} />
    </div>
  );
}
