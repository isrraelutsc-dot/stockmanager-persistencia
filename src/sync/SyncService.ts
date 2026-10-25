import type { Movement } from "../dao/types.ts";
import { MovementDao } from "../dao/MovementDao.ts";

// Contrato del servidor central. En producción sería un API REST (por ejemplo PHP + MySQL en el servidor).
export interface CentralApi {
  pushMovements(batch: Movement[]): Promise<{ id: number; remote_id: string }[]>;
}

export class SyncService {
  constructor(private movements: MovementDao, private api: CentralApi) {}

  // Envía los movimientos pendientes cuando hay conexión. Si el envío falla, nada se marca como
  // sincronizado y se reintenta después, así no se pierde ni se duplica información.
  async syncPending(batchSize = 50): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await this.movements.listPending(batchSize);
      if (batch.length === 0) return total;
      const acks = await this.api.pushMovements(batch);
      await this.movements.markSynced(acks);
      total += acks.length;
      if (acks.length < batch.length) return total; // el servidor aceptó solo una parte
    }
  }
}
