import type { SqlDriver } from "../db/driver.ts";
import type { Movement, NewMovement } from "./types.ts";

const COLS = "id, product_id, type, quantity, moved_at, synced, remote_id";

export class MovementDao {
  constructor(private db: SqlDriver) {}

  // CREATE: queda con synced = 0 hasta que se envíe al servidor central.
  async create(m: NewMovement): Promise<Movement> {
    const movedAt = m.moved_at ?? new Date().toISOString();
    const r = await this.db.run(
      "INSERT INTO movements (product_id, type, quantity, moved_at) VALUES (?, ?, ?, ?)",
      [m.product_id, m.type, m.quantity, movedAt],
    );
    return { id: r.lastInsertId, product_id: m.product_id, type: m.type, quantity: m.quantity, moved_at: movedAt, synced: 0, remote_id: null };
  }

  // READ
  getById(id: number): Promise<Movement | null> {
    return this.db.first<Movement>(`SELECT ${COLS} FROM movements WHERE id = ?`, [id]);
  }
  listByProduct(productId: number): Promise<Movement[]> {
    return this.db.all<Movement>(`SELECT ${COLS} FROM movements WHERE product_id = ? ORDER BY moved_at DESC`, [productId]);
  }
  listPending(limit = 100): Promise<Movement[]> {
    return this.db.all<Movement>(`SELECT ${COLS} FROM movements WHERE synced = 0 ORDER BY id LIMIT ?`, [limit]);
  }
  // Existencias calculadas en una sola consulta agregada (sin traer todos los movimientos).
  async stockOf(productId: number): Promise<number> {
    const r = await this.db.first<{ stock: number }>(
      "SELECT COALESCE(SUM(CASE type WHEN 'IN' THEN quantity ELSE -quantity END), 0) AS stock FROM movements WHERE product_id = ?",
      [productId],
    );
    return r?.stock ?? 0;
  }

  // UPDATE: solo se permite corregir cantidad mientras el movimiento no se haya sincronizado.
  async updateQuantity(id: number, quantity: number): Promise<boolean> {
    const r = await this.db.run("UPDATE movements SET quantity = ? WHERE id = ? AND synced = 0", [quantity, id]);
    return r.changes === 1;
  }

  // DELETE: igual, solo movimientos pendientes (los sincronizados ya existen en el servidor).
  async delete(id: number): Promise<boolean> {
    const r = await this.db.run("DELETE FROM movements WHERE id = ? AND synced = 0", [id]);
    return r.changes === 1;
  }

  // Marca como sincronizados varios movimientos dentro de una sola transacción.
  async markSynced(items: { id: number; remote_id: string }[]): Promise<void> {
    await this.db.transaction(async () => {
      for (const it of items) {
        await this.db.run("UPDATE movements SET synced = 1, remote_id = ? WHERE id = ?", [it.remote_id, it.id]);
      }
    });
  }
}
