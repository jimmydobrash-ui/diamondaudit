export type CsvCell = string | number | null | undefined;

/** Serialize rows to CSV, quoting/escaping cells that contain commas, quotes, or newlines. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const escape = (value: CsvCell): string => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(row => row.map(escape).join(",")).join("\r\n");
}

/** Trigger a client-side download of a CSV string (prepends a BOM so Excel reads UTF-8). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
