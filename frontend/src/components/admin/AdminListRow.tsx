import React from "react";

export function AdminListRow({ children }: { children: React.ReactNode }) {
  return <li className="admin-row">{children}</li>;
}

export default AdminListRow;
