import { DatabaseSync } from "node:sqlite";
import type { RunResult, SqlDriver, SqlValue } from "./driver.ts";

// Adaptador para pruebas en Node: usa SQLite real (archivo o :memory:), no un simulador.
export function openNodeDriver(path = ":memory:"): SqlDriver {
  const db = new DatabaseSync(path);
  return {
    async exec(sql) { db.exec(sql); },
    async run(sql, params: SqlValue[] = []): Promise<RunResult> {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertId: Number(r.lastInsertRowid) };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params).map((r) => ({ ...r })) as T[]; // node:sqlite devuelve objetos sin prototipo
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      const r = db.prepare(sql).get(...params);
      return r ? ({ ...r } as T) : null;
    },
    async transaction<T>(fn: () => Promise<T>) {
      db.exec("BEGIN");
      try { const r = await fn(); db.exec("COMMIT"); return r; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    async close() { db.close(); },
  };
}
