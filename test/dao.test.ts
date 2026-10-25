import { test } from "node:test";
import assert from "node:assert/strict";
import { openNodeDriver } from "../src/db/nodeDriver.ts";
import { migrate, SCHEMA_VERSION } from "../src/db/schema.ts";
import { ProductDao } from "../src/dao/ProductDao.ts";
import { MovementDao } from "../src/dao/MovementDao.ts";
import { SyncService, type CentralApi } from "../src/sync/SyncService.ts";

async function setup() {
  const db = openNodeDriver();
  await migrate(db);
  return { db, products: new ProductDao(db), movements: new MovementDao(db) };
}

test("migrate deja la base en la versión actual y es idempotente", async () => {
  const { db } = await setup();
  assert.equal(await migrate(db), SCHEMA_VERSION);
  assert.equal((await db.first<{ user_version: number }>("PRAGMA user_version"))?.user_version, SCHEMA_VERSION);
});

test("CRUD de productos", async () => {
  const { products } = await setup();
  const p = await products.create("A-100", "Tornillo 1/4");           // C
  assert.deepEqual(await products.getById(p.id), p);                   // R
  assert.equal((await products.getByCode("A-100"))?.name, "Tornillo 1/4");
  assert.equal(await products.update(p.id, "Tornillo 3/8"), true);     // U
  assert.equal((await products.getById(p.id))?.name, "Tornillo 3/8");
  assert.equal(await products.delete(p.id), true);                     // D
  assert.equal(await products.getById(p.id), null);
});

test("CRUD de movimientos y existencias", async () => {
  const { products, movements } = await setup();
  const p = await products.create("B-200", "Caja");
  const m1 = await movements.create({ product_id: p.id, type: "IN", quantity: 50 });  // C
  const m2 = await movements.create({ product_id: p.id, type: "OUT", quantity: 8 });
  assert.equal(m1.synced, 0);
  assert.equal((await movements.getById(m1.id))?.quantity, 50);                       // R
  assert.equal(await movements.stockOf(p.id), 42);
  assert.equal(await movements.updateQuantity(m2.id, 10), true);                      // U
  assert.equal(await movements.stockOf(p.id), 40);
  assert.equal(await movements.delete(m2.id), true);                                  // D
  assert.equal(await movements.stockOf(p.id), 50);
  assert.equal((await movements.listByProduct(p.id)).length, 1);
});

test("integridad: código repetido, cantidad inválida, tipo inválido y producto inexistente", async () => {
  const { products, movements } = await setup();
  const p = await products.create("C-300", "Tuerca");
  await assert.rejects(() => products.create("C-300", "Otra"), /UNIQUE/);
  await assert.rejects(() => movements.create({ product_id: p.id, type: "IN", quantity: 0 }), /CHECK/);
  await assert.rejects(() => movements.create({ product_id: p.id, type: "XX" as any, quantity: 1 }), /CHECK/);
  await assert.rejects(() => movements.create({ product_id: 9999, type: "IN", quantity: 1 }), /FOREIGN KEY/);
});

test("no se puede borrar un producto con movimientos (ON DELETE RESTRICT)", async () => {
  const { products, movements } = await setup();
  const p = await products.create("D-400", "Arandela");
  await movements.create({ product_id: p.id, type: "IN", quantity: 5 });
  await assert.rejects(() => products.delete(p.id), /FOREIGN KEY/);
});

test("transacción: si falla, no queda nada a medias (rollback)", async () => {
  const { db, products } = await setup();
  await assert.rejects(() => db.transaction(async () => {
    await products.create("E-500", "Uno");
    await products.create("E-500", "Repetido"); // viola UNIQUE
  }));
  assert.equal((await products.list()).length, 0);
});

test("sincronización: marca como sincronizados solo los aceptados y no duplica", async () => {
  const { products, movements } = await setup();
  const p = await products.create("F-600", "Pallet");
  for (let i = 0; i < 5; i++) await movements.create({ product_id: p.id, type: "IN", quantity: i + 1 });
  const api: CentralApi = { pushMovements: async (b) => b.map((m) => ({ id: m.id, remote_id: `SRV-${m.id}` })) };
  const sync = new SyncService(movements, api);
  assert.equal(await sync.syncPending(2), 5);
  assert.equal((await movements.listPending()).length, 0);
  assert.equal(await sync.syncPending(), 0);
  const first = await movements.getById(1);
  assert.equal(first?.synced, 1); assert.equal(first?.remote_id, "SRV-1");
  assert.equal(await movements.updateQuantity(1, 99), false); // ya sincronizado: no editable
  assert.equal(await movements.delete(1), false);
});

test("sincronización: si el servidor falla, los movimientos siguen pendientes", async () => {
  const { products, movements } = await setup();
  const p = await products.create("G-700", "Cinta");
  await movements.create({ product_id: p.id, type: "IN", quantity: 3 });
  const sync = new SyncService(movements, { pushMovements: async () => { throw new Error("sin conexión"); } });
  await assert.rejects(() => sync.syncPending(), /sin conexión/);
  assert.equal((await movements.listPending()).length, 1);
});
