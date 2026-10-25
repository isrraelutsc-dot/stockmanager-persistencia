# StockManager

Inventario offline para almacenes sin conexión (AVS.03.02.01 Persistencia y acceso a datos).
React Native + TypeScript + SQLite (`expo-sqlite`). Los datos se guardan en el dispositivo y se
sincronizan con el servidor central cuando vuelve la conexión.

- `src/db/` esquema versionado (migraciones) y adaptadores SQLite (Expo para el iPhone, Node para pruebas)
- `src/dao/` objetos de acceso a datos con CRUD (`ProductDao`, `MovementDao`)
- `src/sync/` cola de sincronización (`SyncService`)
- `test/` pruebas con SQLite real · `scripts/` demostraciones de persistencia y optimización

```
npm install
npm test                    # 8 pruebas (CRUD, integridad, transacciones, sincronización)
npm run demo:persistencia   # escribe en un proceso y lee en otro
npm run demo:optimizacion   # medición con y sin índices/transacciones
npm start                   # app con Expo Go en el iPhone
```
