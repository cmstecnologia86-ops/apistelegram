import { pool } from "./db.js";
import { safeLimit } from "../utils/text.js";
import { formatDateYYYYMMDD } from "../utils/dates.js";

export async function getMeetings({ mode = "recent", days = 7, limit = 10 } = {}) {
  const safe = safeLimit(limit, 1, 50, 10);
  const safeDays = safeLimit(days, 1, 365, 7);
  let where = "";
  if (mode === "today") where = "WHERE DATE(meeting_date) = CURDATE()";
  if (mode === "week") where = "WHERE meeting_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
  if (mode === "window") where = "WHERE meeting_date BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND CURDATE()";
  const sql = `
    SELECT id, title, meeting_date, location
    FROM meetings
    ${where}
    ORDER BY meeting_date DESC
    LIMIT ?
  `;
  const params = mode === "window" ? [safeDays, safe] : [safe];
  const [rows] = await pool.query(sql, params);
  const items = rows.map((r) => ({ id: r.id, title: r.title, date: formatDateYYYYMMDD(r.meeting_date), location: r.location || null }));
  const label = mode === "today" ? "Reuniones de hoy" : mode === "week" ? "Reuniones de la semana" : mode === "window" ? `Reuniones (${safeDays} días)` : "Reuniones recientes";
  const text = items.length ? `${label}: ${items.length}\n\n` + items.map((x, i) => `${i + 1}) ${x.title} — ${x.date}${x.location ? ` — ${x.location}` : ""}`).join("\n") : `${label}: 0\nSin resultados.`;
  return { ok: true, intent: "meetings", text, data: { total: items.length, items } };
}
