import { pool } from "./db.js";
import { safeLimit } from "../utils/text.js";
import { formatDateYYYYMMDD } from "../utils/dates.js";

export async function getActivities({ mode = "recent", days = 7, limit = 10 } = {}) {
  const safe = safeLimit(limit, 1, 50, 10);
  const safeDays = safeLimit(days, 1, 365, 7);
  let where = "";
  if (mode === "today") where = "WHERE DATE(activity_date) = CURDATE()";
  if (mode === "week") where = "WHERE activity_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
  if (mode === "window") where = "WHERE activity_date BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND CURDATE()";
  const sql = `
    SELECT id, title, activity_date, project_name
    FROM activities
    ${where}
    ORDER BY activity_date DESC
    LIMIT ?
  `;
  const params = mode === "window" ? [safeDays, safe] : [safe];
  const [rows] = await pool.query(sql, params);
  const items = rows.map((r) => ({ id: r.id, title: r.title, date: formatDateYYYYMMDD(r.activity_date), project_name: r.project_name || null }));
  const label = mode === "today" ? "Actividades de hoy" : mode === "week" ? "Actividades de la semana" : mode === "window" ? `Actividades (${safeDays} días)` : "Actividades recientes";
  const text = items.length ? `${label}: ${items.length}\n\n` + items.map((x, i) => `${i + 1}) ${x.title} — ${x.date}${x.project_name ? ` — ${x.project_name}` : ""}`).join("\n") : `${label}: 0\nSin resultados.`;
  return { ok: true, intent: "activities", text, data: { total: items.length, items } };
}
