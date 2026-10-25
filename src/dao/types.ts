export type MovementType = "IN" | "OUT";

export interface Product {
  id: number;
  code: string;
  name: string;
}

export interface Movement {
  id: number;
  product_id: number;
  type: MovementType;
  quantity: number;
  moved_at: string; // ISO 8601
  synced: 0 | 1;
  remote_id: string | null;
}

export interface NewMovement {
  product_id: number;
  type: MovementType;
  quantity: number;
  moved_at?: string;
}
