export type Role = "ciudadano" | "operador" | "admin" | "conductor";
export type View = "dashboard" | "schedules" | "reports" | "waste" | "routes" | "admin" | "analytics";

export type Zone = { id: number; name: string; latitude: number; longitude: number; criticality: string };
export type Schedule = { id: number; zone: string; zone_id?: number; day: string; time: string; waste: string };
export type Truck = { id: number; code: string; driver: string; status: string; zone: string; zone_id?: number; latitude: number; longitude: number };
export type Route = { id: number; truck: string; zone: string; progress: number; eta: string; delay: string; latitude: number; longitude: number };
export type Report = { id: number; citizen: string; zone: string; type: string; detail: string; status: string; driver?: string };
export type Collection = { id: number; zone: string; truck: string; kg: number; status: string; date: string };
export type Summary = { zones: number; active_trucks: number; open_reports: number; confirmed_collections: number; total_kg: number; compliance: number };
export type Session = { id?: number; name: string; email: string; role: Role; zone: string };
type Performance = {
  total_routes: number;
  delayed_routes: number;
  low_progress_routes: number;
  average_progress: number;
  open_reports: number;
  average_container_fill: number;
  compliance_estimate: number;
};

export type Bootstrap = { zones: Zone[]; schedules: Schedule[]; trucks: Truck[]; routes: Route[]; reports: Report[]; collections: Collection[]; analytics: Summary; performance?: Performance; users?: Session[]; containers?: Array<{ id: number; zone_id: number; name: string; fill_level: number; status: string; updated_at: string }>; maintenance?: Array<{ id: number; truck_id: number; description: string; status: string; created_at: string }>; notifications?: Array<{ id: number; user_id: number; title: string; message: string; type: string; is_read: boolean; created_at: string }>; prioritized_zones?: Array<{ id: number; name: string; priority_score: number; criticality: string; latitude?: number; longitude?: number }>; optimized_routes?: Route[]; truck_assignments?: Array<{ route_id: number; truck_code: string; zone: string; priority: string; eta: string; action?: string }> ; intervention_plan?: Array<{ title: string; detail: string; priority: string; zone?: string | null; route?: string | null }> };
export type Monitor = Partial<Bootstrap> & {
  alerts?: string[];
  performance?: {
    total_routes: number;
    delayed_routes: number;
    low_progress_routes: number;
    average_progress: number;
    open_reports: number;
    average_container_fill: number;
    compliance_estimate: number;
  };
};

export type ReportStatus = "Pendiente" | "En revision" | "Resuelto";
export type OperationUpdatePayload = {
  type: "route_update" | "container_update";
  id: number;
  progress?: number;
  delay?: string;
  fill_level?: number;
  status?: string;
  note?: string;
};
