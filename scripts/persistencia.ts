// Verifica que la información persiste al "reiniciar la app": cada fase corre en un proceso distinto.
import { spawnSync } from "node:child_process";
import { unlinkSync, existsSync } from "node:fs";
import { openNodeDriver } from "../src/db/nodeDriver.ts";
import { migrate } from "../src/db/schema.ts";
import { ProductDao } from "../src/dao/ProductDao.ts";
import { MovementDao } from "../src/dao/MovementDao.ts";

const FILE = "./persistencia-demo.db";
const fase = process.argv[2];

async function abrir() {
  const db = openNodeDriver(FILE);
  await migrate(db);
  return { db, products: new ProductDao(db), movements: new MovementDao(db) };
}

if (fase === "escribir") {
  const { db, products, movements } = await abrir();
  const p = await products.create("SKU-001", "Caja de herramientas");
  await movements.create({ product_id: p.id, type: "IN", quantity: 120, moved_at: "2026-10-25T09:00:00.000Z" });
  await movements.create({ product_id: p.id, type: "OUT", quantity: 35, moved_at: "2026-10-25T11:30:00.000Z" });
  console.log("[proceso 1] guardado: 1 producto, 2 movimientos. Existencias:", await movements.stockOf(p.id));
  await db.close();
} else if (fase === "leer") {
  const { db, products, movements } = await abrir();
  const p = await products.getByCode("SKU-001");
  console.log("[proceso 2] después de reiniciar -> producto:", JSON.stringify(p));
  console.log("[proceso 2] movimientos:", JSON.stringify(await movements.listByProduct(p!.id)));
  console.log("[proceso 2] existencias:", await movements.stockOf(p!.id), "| pendientes de sincronizar:", (await movements.listPending()).length);
  await db.close();
} else {
  if (existsSync(FILE)) unlinkSync(FILE);
  const base = ["--experimental-transform-types", "--disable-warning=ExperimentalWarning", "scripts/persistencia.ts"];
  for (const f of ["escribir", "leer"]) {
    const r = spawnSync(process.execPath, [...base, f], { stdio: "inherit" });
    if (r.status !== 0) process.exit(1);
  }
  unlinkSync(FILE);
}
