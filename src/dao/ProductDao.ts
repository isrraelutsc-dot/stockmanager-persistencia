import type { SqlDriver } from "../db/driver.ts";
import type { Product } from "./types.ts";

export class ProductDao {
  constructor(private db: SqlDriver) {}

  // CREATE
  async create(code: string, name: string): Promise<Product> {
    const r = await this.db.run("INSERT INTO products (code, name) VALUES (?, ?)", [code.trim(), name.trim()]);
    return { id: r.lastInsertId, code: code.trim(), name: name.trim() };
  }

  // READ
  getById(id: number): Promise<Product | null> {
    return this.db.first<Product>("SELECT id, code, name FROM products WHERE id = ?", [id]);
  }
  getByCode(code: string): Promise<Product | null> {
    return this.db.first<Product>("SELECT id, code, name FROM products WHERE code = ?", [code.trim()]);
  }
  list(): Promise<Product[]> {
    return this.db.all<Product>("SELECT id, code, name FROM products ORDER BY name");
  }

  // UPDATE
  async update(id: number, name: string): Promise<boolean> {
    const r = await this.db.run("UPDATE products SET name = ? WHERE id = ?", [name.trim(), id]);
    return r.changes === 1;
  }

  // DELETE (la llave foránea impide borrar un producto que ya tiene movimientos)
  async delete(id: number): Promise<boolean> {
    const r = await this.db.run("DELETE FROM products WHERE id = ?", [id]);
    return r.changes === 1;
  }
}
