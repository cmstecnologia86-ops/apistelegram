import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.GESTOR_DB_HOST,
  port: Number(process.env.GESTOR_DB_PORT || 3306),
  user: process.env.GESTOR_DB_USER,
  password: process.env.GESTOR_DB_PASSWORD,
  database: process.env.GESTOR_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}
