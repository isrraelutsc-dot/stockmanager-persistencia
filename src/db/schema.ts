import type { SqlDriver } from "./driver.ts";

// Migraciones versionadas con PRAGMA user_version: al abrir la app solo se aplican las que faltan.
const MIGRATIONS: string[] = [
  // v1: modelo de datos
  `
  CREATE TABLE products (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    code  TEXT    NOT NULL UNIQUE,
    name  TEXT    NOT NULL
  );
  CREATE TABLE movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    type        TEXT    NOT NULL CHECK (type IN ('IN','OUT')),
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    moved_at    TEXT    NOT NULL,
    synced      INTEGER NOT NULL DEFAULT 0 CHECK (synced IN (0,1)),
    remote_id   TEXT
  );
  `,
  // v2: índices para las consultas frecuentes (ver scripts/optimizacion.ts)
  `
  CREATE INDEX idx_movements_product_date ON movements(product_id, moved_at);
  CREATE INDEX idx_movements_pending ON movements(id) WHERE synced = 0;
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: SqlDriver): Promise<number> {
  await db.exec("PRAGMA foreign_keys = ON;");
  const row = await db.first<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[version]);
    });
    version++;
    await db.exec(`PRAGMA user_version = ${version};`);
  }
  return version;
}
