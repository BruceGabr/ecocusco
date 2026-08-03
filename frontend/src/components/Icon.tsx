import {
  LayoutDashboard,
  Clock3,
  FileText,
  Trash2,
  MapPin,
  Settings,
  BarChart3,
  LogOut,
  Sun,
  Moon,
  Search,
  Download,
  Map,
  Bell,
  Truck,
  Check,
  TriangleAlert,
  Leaf,
  Users,
  Pencil,
  Recycle,
  BottleWine,
  Package,
  Activity,
} from 'lucide-react';

import React from 'react';

export type IconName =
  | 'dashboard'
  | 'schedules'
  | 'reports'
  | 'waste'
  | 'routes'
  | 'operations'
  | 'admin'
  | 'analytics'
  | 'logout'
  | 'sun'
  | 'moon'
  | 'search'
  | 'download'
  | 'map'
  | 'bell'
  | 'truck'
  | 'check'
  | 'alert'
  | 'leaf'
  | 'users'
  | 'edit'
  | 'trash'
  | 'recycle'
  | 'plastic'
  | 'glass'
  | 'paper';
const icons = {
  dashboard: LayoutDashboard,
  schedules: Clock3,
  reports: FileText,
  waste: Recycle,
  routes: MapPin,
  operations: Activity,
  admin: Settings,
  analytics: BarChart3,
  logout: LogOut,
  sun: Sun,
  moon: Moon,
  search: Search,
  download: Download,
  map: Map,
  bell: Bell,
  truck: Truck,
  check: Check,
  alert: TriangleAlert,
  leaf: Leaf,
  users: Users,
  edit: Pencil,
  trash: Trash2,
  recycle: Recycle,
  plastic: Recycle,
  glass: BottleWine,
  paper: FileText,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const LucideIcon = icons[name];

  return <LucideIcon size={size} strokeWidth={1.8} aria-hidden='true' />;
}

export default Icon;
