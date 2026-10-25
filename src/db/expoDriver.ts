import * as SQLite from "expo-sqlite";
import type { RunResult, SqlDriver, SqlValue } from "./driver.ts";

// Adaptador para la app móvil (iPhone con Expo Go o build propio).
export async function openExpoDriver(name = "stockmanager.db"): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);
  return {
    exec: (sql) => db.execAsync(sql),
    async run(sql, params: SqlValue[] = []): Promise<RunResult> {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes, lastInsertId: r.lastInsertRowId };
    },
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    async first<T>(sql: string, params: SqlValue[] = []) {
      return (await db.getFirstAsync<T>(sql, params)) ?? null;
    },
    transaction: (fn) => {
      let result: any;
      return db.withTransactionAsync(async () => { result = await fn(); }).then(() => result);
    },
    close: () => db.closeAsync(),
  };
}
