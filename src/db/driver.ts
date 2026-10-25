// Interfaz mínima de acceso a SQLite. Los DAO solo dependen de ella, así el mismo código
// corre en el iPhone (expo-sqlite) y en las pruebas de Node (node:sqlite).
export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertId: number;
}

export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
