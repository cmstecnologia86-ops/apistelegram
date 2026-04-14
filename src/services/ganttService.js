import { pool } from "./db.js";
import { safeLimit } from "../utils/text.js";
import { formatDateYYYYMMDD } from "../utils/dates.js";

export async function getGantt({ mode = "upcoming", limit = 10 } = {}) {
  const safe = safeLimit(limit, 1, 50, 10);
  let where = "WHERE milestone_date IS NOT NULL";
  if (mode === "today") where += " AND DATE(milestone_date) = CURDATE()";
  if (mode === "week") where += " AND milestone_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
  const sql = `
    SELECT id, project_name, milestone_name, milestone_date, status
    FROM gantt_items
    ${where}
    ORDER BY milestone_date ASC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [safe]);
  const items = rows.map((r) => ({ id: r.id, project_name: r.project_name, milestone_name: r.milestone_name, date: formatDateYYYYMMDD(r.milestone_date), status: r.status || null }));
  const label = mode === "today" ? "Gantt de hoy" : mode === "week" ? "Gantt de la semana" : "Gantt próximo";
  const text = items.length ? `${label}: ${items.length}\n\n` + items.map((x, i) => `${i + 1}) ${x.project_name} — ${x.milestone_name} — ${x.date}`).join("\n") : `${label}: 0\nSin resultados.`;
  return { ok: true, intent: "gantt", text, data: { total: items.length, items } };
}
