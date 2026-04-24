import express from "express";
import mysql from "mysql2/promise";

const router = express.Router();

function boolEnv(value) {
  return String(value || "").toLowerCase() === "true";
}

function dbConfig(prefix) {
  return {
    host: process.env[`${prefix}_MYSQL_HOST`] || process.env.MYSQL_HOST,
    port: Number(process.env[`${prefix}_MYSQL_PORT`] || process.env.MYSQL_PORT || 3306),
    database: process.env[`${prefix}_MYSQL_DATABASE`] || process.env.MYSQL_DATABASE,
    user: process.env[`${prefix}_MYSQL_USER`] || process.env.MYSQL_USER,
    password: process.env[`${prefix}_MYSQL_PASSWORD`] || process.env.MYSQL_PASSWORD,
    ssl: boolEnv(process.env[`${prefix}_MYSQL_SSL`] || process.env.MYSQL_SSL) ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 8000
  };
}

async function checkDb(name, prefix) {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig(prefix));
    await conn.query("SELECT 1 AS ok");
    return { name, ok: true, status: "OK" };
  } catch (error) {
    return { name, ok: false, status: "ERROR", error: error.message };
  } finally {
    if (conn) await conn.end();
  }
}

async function checkGestorIso(),
    checkGestorIsoLogin() {
  try {
    const baseUrl = process.env.GESTOR_ISO_BASE_URL;
    if (!baseUrl) return { name: "GESTOR_ISO", ok: false, status: "ERROR", error: "Falta GESTOR_ISO_BASE_URL" };

    const res = await fetch(baseUrl, { method: "GET" });
    return { name: "GESTOR_ISO", ok: res.ok, status: res.ok ? "OK" : "ERROR", httpStatus: res.status };
  } catch (error) {
    return { name: "GESTOR_ISO", ok: false, status: "ERROR", error: error.message };
  }
}

router.get("/", async (_req, res) => {
  const checks = await Promise.all([
    checkDb("CQS", "CQS"),
    checkDb("SISCAP", "SISCAP"),
    checkDb("MYSQL", ""),
    checkGestorIso(),
    checkGestorIsoLogin()
  ]);

  return res.json({
    ok: checks.every((x) => x.ok),
    service: "openclaw-task-api",
    endpoint: "access-check",
    checks,
    text: checks.map((x) => `${x.name}: ${x.status}`).join(" | "),
    timestamp: new Date().toISOString()
  });
});

export default router;

