/**
 * Export data to CSV (Excel-compatible) with UTF-8 BOM for Hebrew support.
 */
export function exportToExcel(
  data: Record<string, string | number | boolean | null | undefined>[],
  headers: { key: string; label: string }[],
  filename: string
) {
  const headerRow = headers.map(h => `"${h.label}"`).join(",");
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h.key];
      if (val === null || val === undefined) return '""';
      if (typeof val === "boolean") return val ? '"כן"' : '"לא"';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );

  const csvContent = [headerRow, ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
