import React, { useState, useEffect } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import type { Medicine, InventoryBatch } from "../types/database";

const initialForm = {
  name: "",
  brand: "",
  category: "",
  unit_type: "Strip",
  selling_price: "",
  minimum_stock: "",
};

function getTodayDateZeroTime() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function MedicinesPage() {
  const [form, setForm] = useState(initialForm);
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch medicines and batches on mount
  useEffect(() => {
    fetchMedicinesAndBatches();
    // eslint-disable-next-line
  }, []);

  // Fetch medicines and inventory batches
  async function fetchMedicinesAndBatches() {
    setLoadingList(true);
    setError(null);
    try {
      const [{ data: medicinesData, error: medError }, { data: batchesData, error: batchError }] =
        await Promise.all([
          supabase.from("medicines").select("*").order("name", { ascending: true }),
          supabase.from("inventory_batches").select("*"),
        ]);
      if (medError) throw medError;
      if (batchError) throw batchError;
      setMedicines((medicinesData || []) as Medicine[]);
      setBatches((batchesData || []) as InventoryBatch[]);
    } catch (err) {
      setError("Couldn't load medicines right now.");
      setMedicines([]);
      setBatches([]);
    }
    setLoadingList(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSaveMedicine(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Safely convert and validate numeric inputs
    const name = form.name.trim();
    const brand = form.brand.trim() || null;
    const category = form.category.trim() || null;
    const unit_type = form.unit_type;

    // Only accept valid finite numbers for the numeric columns, avoid sending strings
    const selling_price =
      form.selling_price !== "" && isFinite(Number(form.selling_price))
        ? Number(form.selling_price)
        : NaN;
    const minimum_stock =
      form.minimum_stock !== "" && isFinite(Number(form.minimum_stock))
        ? Number(form.minimum_stock)
        : NaN;

    if (!name) {
      setError("Please enter medicine name.");
      return;
    }
    if (
      isNaN(selling_price) ||
      selling_price < 0
    ) {
      setError("Please enter a valid selling price.");
      return;
    }
    if (
      isNaN(minimum_stock) ||
      minimum_stock < 0
    ) {
      setError("Please enter a valid minimum stock.");
      return;
    }

    setLoadingSave(true);
    const { error: insertError } = await supabase
      .from("medicines")
      .insert([
        {
          name,
          brand,
          category,
          unit_type,
          selling_price,   // safe number (not string)
          minimum_stock,   // safe number (not string)
        },
      ]);

    setLoadingSave(false);
    if (insertError) {
      setError("Couldn't save. Please try again.");
      return;
    } else {
      setSuccess("Medicine saved!");
      setForm(initialForm);
      // To reset select field
      setForm(() => ({ ...initialForm }));
      fetchMedicinesAndBatches();
      // Hide success message after short delay
      setTimeout(() => setSuccess(null), 1500);
    }
  }

  // Compute available (non-expired) stock for each medicine
  function getAvailableStockFor(medId: string): number {
    const today = getTodayDateZeroTime().getTime();
    return batches
      .filter(
        (b) =>
          b.medicine_id === medId &&
          b.quantity_available > 0 &&
          (!b.expiry_date || new Date(b.expiry_date).getTime() > today)
      )
      .reduce((sum, b) => sum + (b.quantity_available || 0), 0);
  }

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#f6f8fb",
        paddingBottom: 90,
      }}
    >
      <PageHeader
        title="Medicines"
        subtitle="Add and manage medicine names"
      />
      <div className="mt-9 mb-7">
        <Card className="p-7 rounded-xl">
          <form
            className="flex flex-col gap-5"
            onSubmit={handleSaveMedicine}
            autoComplete="off"
          >
            <Input
              id="med-name"
              name="name"
              label="Medicine Name"
              placeholder="Enter medicine name"
              autoComplete="off"
              value={form.name}
              onChange={handleInputChange}
              disabled={loadingSave}
              required
            />
            <Input
              id="brand"
              name="brand"
              label="Brand"
              placeholder="Enter brand"
              autoComplete="off"
              value={form.brand}
              onChange={handleInputChange}
              disabled={loadingSave}
            />
            <Input
              id="category"
              name="category"
              label="Category"
              placeholder="Enter category"
              autoComplete="off"
              value={form.category}
              onChange={handleInputChange}
              disabled={loadingSave}
            />
            <div>
              <label
                htmlFor="unit-type"
                className="block mb-2 text-slate-800 font-medium text-lg"
              >
                Unit Type
              </label>
              <select
                id="unit-type"
                name="unit_type"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base bg-white text-slate-700 focus:outline-none focus:border-blue-500 appearance-none"
                value={form.unit_type}
                onChange={handleInputChange}
                disabled={loadingSave}
              >
                <option value="Strip">Strip</option>
                <option value="Bottle">Bottle</option>
                <option value="Tablet">Tablet</option>
              </select>
            </div>
            <Input
              id="selling-price"
              name="selling_price"
              label="Selling Price"
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter selling price"
              autoComplete="off"
              value={form.selling_price}
              onChange={handleInputChange}
              disabled={loadingSave}
              required
            />
            <Input
              id="min-stock"
              name="minimum_stock"
              label="Minimum Stock Alert"
              type="number"
              step="1"
              min="0"
              placeholder="Enter minimum stock"
              autoComplete="off"
              value={form.minimum_stock}
              onChange={handleInputChange}
              disabled={loadingSave}
              required
            />
            {error && (
              <div className="text-red-600 text-base bg-red-50 rounded-md p-3 text-center">{error}</div>
            )}
            {success && (
              <div className="text-green-700 text-base bg-green-50 rounded-md p-3 text-center">{success}</div>
            )}
            <Button
              type="submit"
              className="w-full mt-4 text-2xl py-5 rounded-xl"
              fullWidth
              disabled={loadingSave}
            >
              {loadingSave ? "Saving..." : "Save Medicine"}
            </Button>
          </form>
        </Card>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-3 px-2">Saved Medicines</h2>
        {loadingList ? (
          <div className="text-center text-lg text-slate-600 py-10">Loading medicines...</div>
        ) : error && medicines.length === 0 ? (
          <div className="text-center text-red-600 py-8">{error}</div>
        ) : medicines.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            No medicines yet. Add your first one!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {medicines.map((med) => {
              const availableStock = getAvailableStockFor(med.id);
              return (
                <Card key={med.id} className="px-5 py-4 rounded-lg">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-lg text-slate-800">
                      {med.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-base text-slate-600">
                      <span>
                        Unit: <span className="font-medium text-slate-700">{med.unit_type}</span>
                      </span>
                      <span>
                        Price: <span className="font-medium text-slate-700">₹{med.selling_price.toFixed(2)}</span>
                      </span>
                      <span>
                        Min Stock: <span className="font-medium text-slate-700">{med.minimum_stock}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-base text-blue-700">
                      <span>
                        Available Stock:{" "}
                        <span className="font-bold text-blue-800">
                          {availableStock}
                        </span>
                      </span>
                    </div>
                    {(med.brand || med.category) && (
                      <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-slate-500">
                        {med.brand && (
                          <span>
                            Brand: <span className="font-medium text-slate-600">{med.brand}</span>
                          </span>
                        )}
                        {med.category && (
                          <span>
                            Category: <span className="font-medium text-slate-600">{med.category}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}