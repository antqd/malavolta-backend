// src/lib/db.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

export const pool = mysql.createPool({
  host: "localhost", // es: localhost
  user: "malavolta", // es: malavolta
  password: "Malavolta123!", // es: Malavolta123!
  database: "malavolta", // es: malavolta
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  dateStrings: true,
  timezone: "Z",
});

/**
 * Ping rapido del DB. Lancia errore se non raggiungibile.
 */
export async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping(); // oppure: await conn.query("SELECT 1");
    return true;
  } finally {
    conn.release();
  }
}
