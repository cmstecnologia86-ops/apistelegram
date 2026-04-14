export function daysUntil(dateValue) {
  const now = new Date();
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());

  return Math.ceil((targetUtc - todayUtc) / 86400000);
}

export function formatDateYYYYMMDD(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function startOfTodaySql() {
  return new Date().toISOString().slice(0, 10);
}
