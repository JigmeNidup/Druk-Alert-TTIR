export function toCsv(rows: string[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function csvCell(value: string) {
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
  if (/[",\r\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}
