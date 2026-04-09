export type Medicine = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit_type: string;
  selling_price: number;
  minimum_stock: number;
};

export type NewMedicineInput = {
  name: string;
  brand: string;
  category: string;
  unit_type: string;
  selling_price: number;
  minimum_stock: number;
};

export type InventoryBatch = {
  id: string;
  medicine_id: string;
  batch_number: string;
  expiry_date: string;
  purchase_price: number;
  quantity_available: number;
};

export type NewInventoryBatchInput = {
  medicine_id: string;
  batch_number: string;
  expiry_date: string;
  purchase_price: number;
  quantity_available: number;
};

export type Sale = {
  id: string;
  customer_name: string | null;
  total_amount: number;
  sold_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  medicine_id: string;
  batch_id: string;
  medicine_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type CartItem = {
  medicine_id: string;
  medicine_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};