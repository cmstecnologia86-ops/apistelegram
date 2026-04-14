import { pool } from "./db.js";
import { safeLimit } from "../utils/text.js";

export async function getProjects({ limit = 10, activeOnly = false } = {}) {
  const safe = safeLimit(limit, 1, 50, 10);
  const sql = `
    SELECT id, code, name, status
    FROM projects
    ${activeOnly ? "WHERE LOWER(COALESCE(status, '')) = 'active'" : ""}
    ORDER BY id DESC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [safe]);
  const items = rows.map((r) => ({ id: r.id, code: r.code || null, name: r.name, status: r.status || null }));
  const title = activeOnly ? `Proyectos activos: ${items.length}` : `Proyectos: ${items.length}`;
  const text = items.length
    ? `${title}\n\n` + items.map((x, i) => `${i + 1}) ${x.code ? `[${x.code}] ` : ""}${x.name}`).join("\n")
    : `${title}\nSin resultados.`;
  return { ok: true, intent: activeOnly ? "projects_active" : "projects_list", text, data: { total: items.length, items } };
}

export async function searchProject({ query }) {
  const q = String(query || "").trim();
  if (!q) return { ok: false, intent: "project_search", text: "Falta query del proyecto." };
  const sql = `
    SELECT id, code, name, status
    FROM projects
    WHERE LOWER(name) LIKE LOWER(CONCAT('%', ?, '%'))
       OR LOWER(code) LIKE LOWER(CONCAT('%', ?, '%'))
    ORDER BY id DESC
    LIMIT 10
  `;
  const [rows] = await pool.query(sql, [q, q]);
  const items = rows.map((r) => ({ id: r.id, code: r.code || null, name: r.name, status: r.status || null }));
  const text = items.length
    ? `Proyectos encontrados: ${items.length}\n\n` + items.map((x, i) => `${i + 1}) ${x.code ? `[${x.code}] ` : ""}${x.name} — ${x.status || "sin estado"}`).join("\n")
    : `No encontré proyectos para \"${q}\".`;
  return { ok: true, intent: "project_search", text, data: { total: items.length, items } };
}
