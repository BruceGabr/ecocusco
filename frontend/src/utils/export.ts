export function exportToCSV(filename: string, data: any[]) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => headers.map(h => JSON.stringify(row[h])).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(title: string, html: string) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:system-ui, sans-serif;padding:20px;color:#1f2937;}h1,h2{margin:0 0 16px;}h1{font-size:24px;}h2{font-size:18px;}table{width:100%;border-collapse:collapse;margin-top:16px;}th,td{border:1px solid #d1d5db;padding:10px;text-align:left;}tr:nth-child(even){background:#f9fafb;} .report-card{border:1px solid #d1d5db;border-radius:10px;padding:16px;margin-bottom:16px;} .tag{display:inline-block;background:#e5e7eb;color:#111827;padding:4px 10px;border-radius:999px;font-size:12px;margin-top:8px;}</style></head><body><h1>${title}</h1>${html}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
