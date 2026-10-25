// Mide el efecto de las técnicas de optimización sobre SQLite real: transacción por lotes e índices.
import { DatabaseSync } from "node:sqlite";

const N = 20000;
const db = new DatabaseSync(":memory:");
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
CREATE TABLE movements (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('IN','OUT')), quantity INTEGER NOT NULL CHECK (quantity>0), moved_at TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0, remote_id TEXT);`);
for (let i = 1; i <= 200; i++) db.prepare("INSERT INTO products (code,name) VALUES (?,?)").run(`P-${i}`, `Producto ${i}`);

const ms = (f: () => void) => { const t = performance.now(); f(); return performance.now() - t; };
const ins = db.prepare("INSERT INTO movements (product_id,type,quantity,moved_at) VALUES (?,?,?,?)");
const row = (i: number) => [1 + (i % 200), i % 2 ? "IN" : "OUT", 1 + (i % 9), new Date(2026, 0, 1 + (i % 300)).toISOString()] as const;

// En archivo, cada INSERT sin transacción hace su propio COMMIT (escritura a disco).
import { unlinkSync, existsSync } from "node:fs";
const fpath = "./optimizacion-demo.db";
for (const e of ["", "-wal", "-shm"]) if (existsSync(fpath + e)) unlinkSync(fpath + e);
const fdb = new DatabaseSync(fpath);
fdb.exec(`CREATE TABLE m (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, type TEXT, quantity INTEGER, moved_at TEXT);`);
const fins = fdb.prepare("INSERT INTO m (product_id,type,quantity,moved_at) VALUES (?,?,?,?)");
const M = 2000;
const tSueltos = ms(() => { for (let i = 0; i < M; i++) fins.run(...row(i)); });
fdb.exec("DELETE FROM m;");
const tLote = ms(() => { fdb.exec("BEGIN"); for (let i = 0; i < M; i++) fins.run(...row(i)); fdb.exec("COMMIT"); });
fdb.close(); for (const e of ["", "-wal", "-shm"]) if (existsSync(fpath + e)) unlinkSync(fpath + e);
console.log(`1) Inserción de ${M} movimientos en archivo:`);
console.log(`   sin transacción (un COMMIT por fila): ${tSueltos.toFixed(0)} ms`);
console.log(`   con una sola transacción:             ${tLote.toFixed(0)} ms  (${(tSueltos / tLote).toFixed(1)}x más rápido)\n`);

db.exec("BEGIN"); for (let i = 0; i < N; i++) ins.run(...row(i)); db.exec("COMMIT");
console.log(`2) Consulta de historial de un producto con ${N} movimientos`);
const q = "SELECT id, type, quantity, moved_at FROM movements WHERE product_id = 77 ORDER BY moved_at DESC";
const plan = (sql: string) => (db.prepare("EXPLAIN QUERY PLAN " + sql).all() as any[]).map((r) => r.detail).join(" | ");
const run = (sql: string, n = 300) => ms(() => { const s = db.prepare(sql); for (let i = 0; i < n; i++) s.all(); });
console.log("   SIN índice -> plan:", plan(q));
const antes = run(q);
console.log(`   300 consultas: ${antes.toFixed(0)} ms`);
db.exec("CREATE INDEX idx_movements_product_date ON movements(product_id, moved_at);");
console.log("   CON índice -> plan:", plan(q));
const desp = run(q);
console.log(`   300 consultas: ${desp.toFixed(0)} ms  (${(antes / desp).toFixed(1)}x más rápido)\n`);

console.log("3) Cola de sincronización (movimientos pendientes)");
db.exec("UPDATE movements SET synced = 1 WHERE id > 50;"); // casi todo ya sincronizado: quedan 50 pendientes
const qp = "SELECT id FROM movements WHERE synced = 0 ORDER BY id LIMIT 100";
console.log("   SIN índice parcial -> plan:", plan(qp));
const a2 = run(qp, 2000);
db.exec("CREATE INDEX idx_movements_pending ON movements(id) WHERE synced = 0;");
console.log("   CON índice parcial -> plan:", plan(qp));
const d2 = run(qp, 2000);
console.log(`   2000 consultas: ${a2.toFixed(0)} ms -> ${d2.toFixed(0)} ms`);
