export type BoxStatus = 'packed' | 'loaded' | 'arrived' | 'unpacked' | 'damaged' | 'missing';

export type Box = {
  id: string;
  code: string; // e.g. A-014
  roomFrom: string;
  roomTo: string;
  tags: string[];
  fragile: boolean;
  liquid: boolean;
  photo?: string; // compressed dataURL
  weightKg?: number;
  status: BoxStatus;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type CountAdjustment = {
  id: string;
  delta: number; // 正数=现场比登记多，负数=比登记少
  reason: string;
  createdAt: number;
};

export type MoveTask = {
  id: string;
  title: string;
  from: string;
  to: string;
  date: string;
  rooms: string[];
  boxes: Box[];
  countAdjustments?: CountAdjustment[];
  createdAt: number;
};
