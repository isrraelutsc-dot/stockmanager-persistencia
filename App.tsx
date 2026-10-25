import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { openExpoDriver } from "./src/db/expoDriver.ts";
import { migrate } from "./src/db/schema.ts";
import { ProductDao } from "./src/dao/ProductDao.ts";
import { MovementDao } from "./src/dao/MovementDao.ts";
import type { Movement, Product } from "./src/dao/types.ts";

function Btn({ title, onPress, color = "#12213f" }: { title: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, { backgroundColor: color, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={s.btnText}>{title}</Text>
    </Pressable>
  );
}

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
    Keyboard.dismiss();
    if (!code.trim() || !name.trim()) { setMsg("Escribe el código y el nombre del producto"); return; }
    try {
      const p = (await daos.products.getByCode(code)) ?? (await daos.products.create(code, name));
      setProduct(p); await refresh(p); setMsg(`Producto ${p.code} listo`);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }
  async function add(type: "IN" | "OUT") {
    if (!daos || !product) return;
    Keyboard.dismiss();
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) { setMsg("La cantidad debe ser un número entero mayor que 0"); return; }
    try {
      await daos.movements.create({ product_id: product.id, type, quantity: n });
      await refresh(product); setMsg("Movimiento guardado (pendiente de sincronizar)");
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }
  async function remove(id: number) {
    if (!daos || !product) return;
    await daos.movements.delete(id); await refresh(product);
  }

  if (!daos) return <View style={s.screen}><Text>Abriendo base de datos…</Text></View>;
  return (
    <View style={s.screen}>
      <Text style={s.title}>StockManager</Text>
      <Text style={s.label}>Código del producto</Text>
      <TextInput style={s.input} placeholder="Ej. SKU-001" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} returnKeyType="next" />
      <Text style={s.label}>Nombre</Text>
      <TextInput style={s.input} placeholder="Ej. Caja de herramientas" value={name} onChangeText={setName} returnKeyType="done" onSubmitEditing={saveProduct} />
      <Btn title="Abrir / crear producto" onPress={saveProduct} />
      {product && (
        <View style={s.card}>
          <Text style={s.prod}>{product.code} · {product.name}</Text>
          <Text style={s.stock}>Existencias: {stock}</Text>
          <Text style={s.label}>Cantidad</Text>
          <TextInput style={s.input} value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <View style={s.row}>
            <View style={{ flex: 1 }}><Btn title="ENTRADA" color="#1b7f3b" onPress={() => add("IN")} /></View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}><Btn title="SALIDA" color="#b3541e" onPress={() => add("OUT")} /></View>
          </View>
        </View>
      )}
      {!!msg && <Text style={s.msg}>{msg}</Text>}
      <FlatList
        data={rows}
        keyExtractor={(m) => String(m.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={s.mov}>
            <Text style={{ flex: 1 }}>{item.type === "IN" ? "ENTRADA" : "SALIDA"} {item.quantity} · {item.moved_at.slice(0, 16).replace("T", " ")} · {item.synced ? "sincronizado" : "pendiente"}</Text>
            {!item.synced && <Pressable onPress={() => remove(item.id)}><Text style={s.del}>Borrar</Text></Pressable>}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingTop: 64, paddingHorizontal: 18, backgroundColor: "#fff" },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 13, color: "#555", marginTop: 8, marginBottom: 3 },
  input: { borderWidth: 1, borderColor: "#9aa5b8", borderRadius: 8, paddingHorizontal: 12, height: 46, fontSize: 16, backgroundColor: "#f6f8fc" },
  btn: { marginTop: 10, height: 46, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  card: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: "#d5dbe7", borderRadius: 10 },
  prod: { fontSize: 16, fontWeight: "600" },
  stock: { fontSize: 22, fontWeight: "bold", marginVertical: 4 },
  row: { flexDirection: "row" },
  msg: { marginVertical: 8, color: "#12213f" },
  mov: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eceff5" },
  del: { color: "#c0392b", fontWeight: "600", paddingLeft: 10 },
});
