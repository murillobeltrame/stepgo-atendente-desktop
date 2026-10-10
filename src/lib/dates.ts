/**
 * Datas no fuso do Brasil (America/Sao_Paulo, UTC-3 fixo, sem horário de verão).
 *
 * Não use setHours/getDate/getHours/toLocale*String sem timeZone nem
 * toISOString().slice(0, 10) para fronteiras de dia: dependem do relógio/fuso do
 * navegador ou do processo (UTC). Use estes helpers.
 */

export const BRAZIL_TIMEZONE = "America/Sao_Paulo";
export const BRAZIL_UTC_OFFSET = "-03:00";

type DateInput = Date | string | number | null | undefined;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRAZIL_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(n: number, size = 2) {
  return String(n).padStart(size, "0");
}

function brazilParts(value: DateInput) {
  const date = toDate(value);
  if (!date) return null;
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === "24" ? "00" : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Valida "yyyy-mm-dd" (data de calendário real). */
export function parseCalendarDate(iso: string | null | undefined) {
  const match = ISO_DATE_RE.exec(String(iso ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatIsoParts(year: number, month: number, day: number) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function requireIso(iso: string) {
  const parsed = parseCalendarDate(iso);
  if (!parsed) throw new RangeError(`Data inválida: ${iso}`);
  return parsed;
}

/** "yyyy-mm-dd" do dia (no Brasil) em que o instante cai. "yyyy-mm-dd" passa direto. */
export function brazilDateIso(value: DateInput = new Date()): string | null {
  if (typeof value === "string" && parseCalendarDate(value)) return value.trim();
  const parts = brazilParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : null;
}

/** "Hoje" no Brasil como "yyyy-mm-dd". */
export function brazilTodayIso(now: Date = new Date()): string {
  return brazilDateIso(now) as string;
}

/** Instante do início (00:00:00.000 -03:00) do dia "yyyy-mm-dd". */
export function brazilDayStart(iso: string): Date {
  const { year, month, day } = requireIso(iso);
  return new Date(`${formatIsoParts(year, month, day)}T00:00:00.000${BRAZIL_UTC_OFFSET}`);
}

/** Instante do fim (23:59:59.999 -03:00) do dia "yyyy-mm-dd". */
export function brazilDayEnd(iso: string): Date {
  const { year, month, day } = requireIso(iso);
  return new Date(`${formatIsoParts(year, month, day)}T23:59:59.999${BRAZIL_UTC_OFFSET}`);
}

export function addCalendarDays(iso: string, days: number): string {
  const { year, month, day } = requireIso(iso);
  const date = new Date(Date.UTC(year, month - 1, day + Math.trunc(days)));
  return formatIsoParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Soma meses mantendo o dia, com clamp no último dia do mês (31/01 + 1 = 28/02). */
export function addCalendarMonths(iso: string, months: number): string {
  const { year, month, day } = requireIso(iso);
  const total = year * 12 + (month - 1) + Math.trunc(months);
  const targetYear = Math.floor(total / 12);
  const targetMonth = total - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return formatIsoParts(targetYear, targetMonth + 1, Math.min(day, lastDay));
}

/** Diferença em dias de calendário (b - a). */
export function diffCalendarDays(a: string, b: string): number {
  const pa = requireIso(a);
  const pb = requireIso(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000,
  );
}

/** Intl pt-BR com timeZone fixo, para formatos livres (mês por extenso, dia da semana...). */
export function formatBrazilIntl(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  fallback = "—",
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: BRAZIL_TIMEZONE }).format(date);
}

/** dd/mm/aaaa no fuso do Brasil. */
export function formatBrazilDate(value: DateInput, fallback = "—"): string {
  const parts = brazilParts(value);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : fallback;
}

/** HH:mm no fuso do Brasil. */
export function formatBrazilTime(value: DateInput, fallback = "—"): string {
  const parts = brazilParts(value);
  return parts ? `${parts.hour}:${parts.minute}` : fallback;
}

/** dd/mm/aaaa HH:mm no fuso do Brasil (com ":ss" se seconds). */
export function formatBrazilDateTime(
  value: DateInput,
  options: { fallback?: string; seconds?: boolean } = {},
): string {
  const parts = brazilParts(value);
  if (!parts) return options.fallback ?? "—";
  const time = `${parts.hour}:${parts.minute}${options.seconds ? `:${parts.second}` : ""}`;
  return `${parts.day}/${parts.month}/${parts.year} ${time}`;
}

/** Data de calendário "yyyy-mm-dd" -> "dd/mm/aaaa" sem converter por fuso. */
export function formatCalendarDateBR(iso: string | null | undefined, fallback = "—"): string {
  const parsed = parseCalendarDate(iso);
  return parsed ? `${pad(parsed.day)}/${pad(parsed.month)}/${pad(parsed.year, 4)}` : fallback;
}

/** Valor para <input type="datetime-local"> ("yyyy-mm-ddTHH:mm") em horário do Brasil. */
export function toBrazilDateTimeInput(value: DateInput = new Date()): string {
  const parts = brazilParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` : "";
}

/** Valor de <input type="datetime-local"> interpretado como horário do Brasil. */
export function fromBrazilDateTimeInput(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match || !parseCalendarDate(match[1])) return null;
  const date = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4] ?? "00"}.000${BRAZIL_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}
