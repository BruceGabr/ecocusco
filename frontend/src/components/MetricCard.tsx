import React from "react";

export type MetricTone = "green" | "mustard" | "sage" | "blue" | "yellow" | "white";

export function MetricCard({ icon, tone = "sage", value, label }: { icon: React.ReactNode; tone?: MetricTone; value: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

export default MetricCard;
