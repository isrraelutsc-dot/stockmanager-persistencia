import React, { useCallback, useEffect, useState } from "react";
import { Button, FlatList, SafeAreaView, Text, TextInput, View } from "react-native";
import { openExpoDriver } from "./src/db/expoDriver.ts";
import { migrate } from "./src/db/schema.ts";
import { ProductDao } from "./src/dao/ProductDao.ts";
import { MovementDao } from "./src/dao/MovementDao.ts";
import type { Movement, Product } from "./src/dao/types.ts";

// Pantalla única: alta de producto, registro de entradas/salidas y lista de movimientos del producto.
export default function App() {
  const [daos, setDaos] = useState<{ products: ProductDao; movements: MovementDao } | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [rows, setRows] = useState<Movement[]>([]);
  const [stock, setStock] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const db = await openExpoDriver();
      await migrate(db);
      setDaos({ products: new ProductDao(db), movements: new MovementDao(db) });
    })();
  }, []);

  const refresh = useCallback(async (p: Product) => {
    if (!daos) return;
    setRows(await daos.movements.listByProduct(p.id));
    setStock(await daos.movements.stockOf(p.id));
  }, [daos]);

  async function saveProduct() {
    if (!daos) return;
    if (!code.trim() || !name.trim()) { setMsg("Escribe el código y el nombre del producto"); return; }
    try {
      const p = (await daos.products.getByCode(code)) ?? (await daos.products.create(code, name));
      setProduct(p); await refresh(p); setMsg(`Producto ${p.code} listo`);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }
  async function add(type: "IN" | "OUT") {
    if (!daos || !product) return;
    try {
      await daos.movements.create({ product_id: product.id, type, quantity: Number(qty) });
      await refresh(product); setMsg("Movimiento guardado (pendiente de sincronizar)");
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }
  async function remove(id: number) {
    if (!daos || !product) return;
    await daos.movements.delete(id); await refresh(product);
  }

  if (!daos) return <SafeAreaView><Text>Abriendo base de datos…</Text></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>StockManager</Text>
      <TextInput placeholder="Código del producto" value={code} onChangeText={setCode} autoCapitalize="characters" />
      <TextInput placeholder="Nombre" value={name} onChangeText={setName} />
      <Button title="Abrir / crear producto" onPress={saveProduct} />
      {product && (
        <View style={{ marginTop: 12 }}>
          <Text>{product.code} · {product.name} · Existencias: {stock}</Text>
          <TextInput placeholder="Cantidad" value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <Button title="Registrar ENTRADA" onPress={() => add("IN")} />
          <Button title="Registrar SALIDA" onPress={() => add("OUT")} />
        </View>
      )}
      <Text>{msg}</Text>
      <FlatList data={rows} keyExtractor={(m) => String(m.id)} renderItem={({ item }) => (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text>{item.type} {item.quantity} · {item.moved_at.slice(0, 16)} · {item.synced ? "sincronizado" : "pendiente"}</Text>
          {!item.synced && <Button title="Borrar" onPress={() => remove(item.id)} />}
        </View>
      )} />
    </SafeAreaView>
  );
}
