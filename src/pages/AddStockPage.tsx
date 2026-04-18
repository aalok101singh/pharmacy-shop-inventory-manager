import React, { useState, useEffect, useMemo } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { supabase } from "../lib/supabase";
import type { Medicine, InventoryBatch } from "../types/database";

type FormState = {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: string;
  quantity: string;
};

const initialForm: FormState = {
  medicineId: "",
  batchNumber: "",
  expiryDate: "",
  purchasePrice: "",
  quantity: "",
};

// Format ISO date string to "dd/mm/yyyy"
function formatExpiryDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

// Simple helper to format ISO date string as "DD MMM YYYY"
// NOTE: unused, so we can safely remove this to fix TypeScript error.
/*
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = date.toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC"
    });
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
}
*/

export default function AddStockPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // For per-batch delete loading state
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  // Fetch medicines
  async function fetchMedicines() {
    setLoadingMedicines(true);
    setError(null);
    const { data, error } = await supabase
      .from("medicines")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      setError("Couldn't load medicines right now.");
      setMedicines([]);
    } else {
      setMedicines(data || []);
    }
    setLoadingMedicines(false);
  }

  // Fetch stock batches
  async function fetchBatches() {
    setLoadingBatches(true);
    setError(null);
    const { data, error } = await supabase
      .from("inventory_batches")
      .select("*")
      .order("id", { ascending: false });
    if (error) {
      setError("Couldn't load stock right now.");
      setBatches([]);
    } else {
      setBatches(data || []);
    }
    setLoadingBatches(false);
  }

  useEffect(() => {
    fetchMedicines();
  }, []);

  useEffect(() => {
    fetchBatches();
  }, []);

  // Build a mapping from medicine id to medicine name
  const medicineNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    medicines.forEach((med) => {
      map[med.id] = med.name;
    });
    return map;
  }, [medicines]);

  // Keep change handlers correctly typed for HTML select and controlled string state
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
    setSuccess(null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!form.medicineId) {
      setError("Please select a medicine.");
      return;
    }
    if (!form.batchNumber.trim()) {
      setError("Please enter batch number.");
      return;
    }
    if (!form.expiryDate) {
      setError("Please enter expiry date.");
      return;
    }
    const purchasePriceNum = Number(form.purchasePrice);
    if (
      !form.purchasePrice ||
      isNaN(purchasePriceNum) ||
      purchasePriceNum < 0
    ) {
      setError("Please enter a valid purchase price.");
      return;
    }
    const quantityNum = Number(form.quantity);
    if (
      !form.quantity ||
      !Number.isInteger(quantityNum) ||
      quantityNum <= 0
    ) {
      setError("Please enter a valid quantity.");
      return;
    }

    setSaving(true);

    // Insert into inventory_batches
    const insertData = {
      medicine_id: form.medicineId,
      batch_number: form.batchNumber.trim(),
      expiry_date: form.expiryDate,
      purchase_price: purchasePriceNum,
      quantity_available: quantityNum,
    };

    const { error: insertError } = await supabase
      .from("inventory_batches")
      .insert([insertData]);

    if (insertError) {
      setError("Could not save stock. Please try again.");
      setSaving(false);
      return;
    }

    setSuccess("Stock added successfully!");
    setForm(initialForm);

    // Refresh batch list
    await fetchBatches();

    setSaving(false);
  }

  // === SAFE DELETE FUNCTIONALITY BELOW ===
  async function handleDeleteBatch(batchId: string) {
    // Reset error/success first; set a loading state for this batch
    setError(null);
    setSuccess(null);
    setDeletingBatchId(batchId);

    // 1. Check if there are any sale_items rows referencing this batch
    const { data: saleItems, error: saleItemsError } = await supabase
      .from("sale_items")
      .select("id")
      .eq("batch_id", batchId)
      .limit(1);

    if (saleItemsError) {
      setError("Error checking sale records. Try again.");
      setDeletingBatchId(null);
      return;
    }

    if (saleItems && saleItems.length > 0) {
      setError("Cannot delete this stock because it was already used in a sale");
      setDeletingBatchId(null);
      return;
    }

    // 2. No sale items found; safe to delete
    const { error: deleteError } = await supabase
      .from("inventory_batches")
      .delete()
      .eq("id", batchId);

    if (deleteError) {
      setError("Error deleting stock batch. Try again.");
      setDeletingBatchId(null);
      return;
    }

    setSuccess("Stock batch deleted.");
    await fetchBatches();
    // Optional: re-fetch medicines for dropdown consistency, in case of any effect
    await fetchMedicines();

    setDeletingBatchId(null);
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] pb-[100px]">
      <div className="max-w-[430px] mx-auto">
        <PageHeader
          title="Add Stock"
          subtitle="Add new stock for a medicine"
        />
        <Card className="flex flex-col gap-6 mt-4 mb-4 px-2 py-5">
          <form
            className="flex flex-col gap-5"
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="medicineId" className="text-base font-medium mb-0.5">
                Medicine
              </label>
              <select
                id="medicineId"
                name="medicineId"
                value={form.medicineId}
                onChange={(
                  e: React.ChangeEvent<HTMLSelectElement>
                ) => handleChange(e)}
                className="text-lg py-4 px-4 rounded-md border border-gray-300 focus:outline-none"
                disabled={loadingMedicines || saving}
                required
              >
                <option value="">Select medicine</option>
                {medicines.map((med) => (
                  <option key={med.id} value={String(med.id)}>
                    {med.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="batchNumber" className="text-base font-medium mb-0.5">
                Batch Number
              </label>
              <Input
                id="batchNumber"
                name="batchNumber"
                type="text"
                placeholder="Batch number"
                autoComplete="off"
                className="text-lg py-4 px-4 rounded-md"
                value={form.batchNumber}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="expiryDate" className="text-base font-medium mb-0.5">
                Expiry Date
              </label>
              <Input
                id="expiryDate"
                name="expiryDate"
                type="date"
                className="text-lg py-4 px-4 rounded-md"
                value={form.expiryDate}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="purchasePrice" className="text-base font-medium mb-0.5">
                Purchase Price
              </label>
              <Input
                id="purchasePrice"
                name="purchasePrice"
                type="number"
                min={0}
                step="0.01"
                placeholder="Purchase price"
                className="text-lg py-4 px-4 rounded-md"
                value={form.purchasePrice}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="quantity" className="text-base font-medium mb-0.5">
                Quantity
              </label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                step="1"
                placeholder="Quantity"
                className="text-lg py-4 px-4 rounded-md"
                value={form.quantity}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </div>
            <Button
              type="submit"
              fullWidth
              variant="primary"
              className="mt-2 text-lg py-4 rounded-xl font-semibold bg-green-600 hover:bg-green-700 text-white shadow transition-colors"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Stock"}
            </Button>
            {error && (
              <div className="text-red-600 bg-red-100 px-3 py-2 rounded text-sm mt-2 text-center">
                {error}
              </div>
            )}
            {success && (
              <div className="text-green-700 bg-green-100 px-3 py-2 rounded text-sm mt-2 text-center">
                {success}
              </div>
            )}
          </form>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-2 px-1">Recent Stock</h2>
          {loadingBatches ? (
            <div className="text-center text-gray-500 py-8">Loading stock...</div>
          ) : batches.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              No stock has been added yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {batches.map((batch) => (
                <Card
                  key={batch.id}
                  className="flex flex-col gap-1 px-4 py-3 shadow group"
                >
                  <div className="flex flex-row items-center justify-between">
                    <div className="text-base font-medium">
                      {medicineNameMap[batch.medicine_id] || "Unknown Medicine"}
                    </div>
                    <Button
                      type="button"
                      // size="sm" // Removed because Button does not support 'size' prop
                      variant="secondary"
                      className={`ml-2 px-2 py-[2px] rounded bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors duration-100 text-xs h-[28px] font-semibold ${
                        deletingBatchId === batch.id
                          ? "opacity-60 pointer-events-none"
                          : ""
                      }`}
                      disabled={deletingBatchId === batch.id}
                      onClick={() => handleDeleteBatch(batch.id)}
                      style={{
                        minWidth: 60,
                        fontWeight: 600,
                        fontSize: 13,
                        height: 28,
                      }}
                    >
                      {deletingBatchId === batch.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                  <div className="flex flex-row gap-4 text-sm text-gray-600 mt-1">
                    <span>
                      <span className="font-semibold">Batch:</span> {batch.batch_number}
                    </span>
                    <span>
                      <span className="font-semibold">Expiry:</span>{" "}
                      {formatExpiryDate(batch.expiry_date)}
                    </span>
                  </div>
                  <div className="flex flex-row gap-6 mt-1 text-sm">
                    <span>
                      <span className="font-semibold">Price:</span> ₹
                      {Number(batch.purchase_price).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span>
                      <span className="font-semibold">Qty:</span> {batch.quantity_available}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}