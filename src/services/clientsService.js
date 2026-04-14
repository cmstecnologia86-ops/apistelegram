import { pool } from "./db.js";
import { daysUntil, formatDateYYYYMMDD } from "../utils/dates.js";
import { alertIcon, alertLevel } from "../utils/alerts.js";
import { safeLimit } from "../utils/text.js";

export async function getClients({ limit = 10, activeOnly = false } = {}) {
  const safe = safeLimit(limit, 1, 50, 10);
  const sql = `
    SELECT id, client_name, status
    FROM certification_records
    ${activeOnly ? "WHERE LOWER(COALESCE(status, '')) = 'vigente'" : ""}
    GROUP BY id, client_name, status
    ORDER BY client_name ASC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [safe]);
  const items = rows.map((r) => ({ id: r.id, name: r.client_name, status: r.status || null }));
  const title = activeOnly ? `Clientes activos: ${items.length}` : `Clientes: ${items.length}`;
  const text = items.length
    ? `${title}\n\n` + items.map((x, i) => `${i + 1}) ${x.name}`).join("\n")
    : `${title}\nSin resultados.`;
  return { ok: true, intent: activeOnly ? "clients_active" : "clients_list", text, data: { total: items.length, items } };
}

export async function getClientsExpiring({ days = 60, limit = 5 } = {}) {
  const safeDays = Math.min(Math.max(Number(days || 60), 1), 180);
  const safeLimit = safeLimit(limit, 1, 20, 5);
  const sql = `
    SELECT id, client_name, certification, scope, FE_FINAL AS expiry_date, status
    FROM certification_records
    WHERE LOWER(COALESCE(status, '')) = 'vigente'
      AND FE_FINAL IS NOT NULL
      AND FE_FINAL <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    ORDER BY FE_FINAL ASC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [safeDays, safeLimit]);
  const items = rows.map((row) => {
    const remaining = daysUntil(row.expiry_date);
    return {
      id: row.id,
      name: row.client_name,
      certification: row.certification || null,
      scope: row.scope || null,
      expiry_date: formatDateYYYYMMDD(row.expiry_date),
      days: remaining,
      alert: alertLevel(remaining)
    };
  });
  const totals = {
    red: items.filter((x) => x.alert === "red").length,
    orange: items.filter((x) => x.alert === "orange").length,
    yellow: items.filter((x) => x.alert === "yellow").length,
    purple: items.filter((x) => x.alert === "purple").length
  };
  let text = `Clientes por vencer (${safeDays} días): ${items.length}`;
  if (items.length) {
    text += `\n🔴 ${totals.red} | 🟠 ${totals.orange} | 🟡 ${totals.yellow}`;
    if (totals.purple > 0) text += ` | 🟣 ${totals.purple}`;
    text += "\n\n" + items.map((x, i) => {
      const cert = x.certification ? ` — ${x.certification}` : "";
      const scope = x.scope ? ` — ${x.scope}` : "";
      return `${i + 1}) ${alertIcon(x.alert)} ${x.name}${cert}${scope} — ${x.days} días`;
    }).join("\n");
  } else {
    text += "\nSin clientes en ventana de vencimiento.";
  }
  return { ok: true, intent: "clients_expiring", text, data: { total: items.length, items } };
}

export async function getClientExpiryByName({ clientName }) {
  const rawName = String(clientName || "").trim();
  if (!rawName) {
    return { ok: false, intent: "client_expiry", text: "Falta nombre de cliente." };
  }
  const sql = `
    SELECT id, client_name, certification, scope, FE_FINAL AS expiry_date, status
    FROM certification_records
    WHERE LOWER(COALESCE(status, '')) = 'vigente'
      AND FE_FINAL IS NOT NULL
      AND LOWER(client_name) LIKE LOWER(CONCAT('%', ?, '%'))
    ORDER BY FE_FINAL ASC
    LIMIT 20
  `;
  const [rows] = await pool.query(sql, [rawName]);
  if (!rows.length) {
    return { ok: true, intent: "client_expiry", text: `No encontré vencimientos para \"${rawName}\".`, data: { total: 0, items: [] } };
  }
  const items = rows.map((row) => {
    const remaining = daysUntil(row.expiry_date);
    return {
      id: row.id,
      name: row.client_name,
      certification: row.certification || null,
      scope: row.scope || null,
      expiry_date: formatDateYYYYMMDD(row.expiry_date),
      days: remaining,
      alert: alertLevel(remaining)
    };
  });
  const resolvedName = items[0]?.name || rawName;
  const text = `${resolvedName} — vencimientos encontrados: ${items.length}\n\n` + items.map((x, i) => {
    const cert = x.certification || "Certificación";
    const scope = x.scope ? ` — ${x.scope}` : "";
    return `${i + 1}) ${alertIcon(x.alert)} ${cert}${scope} — vence ${x.expiry_date} (${x.days} días)`;
  }).join("\n");
  return { ok: true, intent: "client_expiry", text, data: { client_name: resolvedName, total: items.length, items } };
}
