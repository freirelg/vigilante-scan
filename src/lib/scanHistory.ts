export interface ScanRecord {
  id: string;
  date: string; // ISO
  score: number;
  grade: "Excelente" | "Bom" | "Atenção" | "Crítico";
  breakdown: { id: string; label: string; score: number }[];
}

const KEY = "freirenet_scan_history_v1";
const MAX = 30;

export function getScanHistory(): ScanRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScanRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addScanRecord(rec: Omit<ScanRecord, "id" | "date"> & { date?: string }): ScanRecord {
  const record: ScanRecord = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    date: rec.date ?? new Date().toISOString(),
    score: rec.score,
    grade: rec.grade,
    breakdown: rec.breakdown,
  };
  const list = [record, ...getScanHistory()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return record;
}

export function clearScanHistory() {
  localStorage.removeItem(KEY);
}
