import React, { useState, useEffect, useMemo, useRef } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import type { Medicine, InventoryBatch } from "../types/database";

// Input component as before
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  error?: string;
  containerClassName?: string;
};

const Input: React.FC<InputProps> = ({
  label,
  error,
  containerClassName,
  className,
  ...props
}) => (
  <div className={containerClassName}>
    {label && (
      <label
        htmlFor={props.id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
    )}
    <input className={className} {...props} />
    {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
  </div>
);

type CartItem = {
  medicine_id: string;
  medicine_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

type MedicineAvailability = {
  available: number; // Non-expired, total in stock
  selling_price: number;
  medicine_name: string;
};

function formatNumber(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isBatchExpired(expiry: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  return expiryDate < today;
}

const FormMessage: React.FC<{ children: React.ReactNode; type: "error" | "success" }> = ({ children, type }) => (
  <div
    className={
      type === "error"
        ? "w-full px-4 py-2 rounded mb-2 bg-red-100 text-red-700 text-center font-semibold text-base"
        : "w-full px-4 py-2 rounded mb-2 bg-green-100 text-green-700 text-center font-semibold text-base"
    }
    style={{ letterSpacing: 0.2 }}
    role={type === "error" ? "alert" : "status"}
  >
    {children}
  </div>
);

const BillMessage: React.FC<{ children: React.ReactNode; type: "error" | "success" }> = ({ children, type }) => (
  <div
    className={
      type === "error"
        ? "w-full px-4 py-2 rounded mb-3 bg-red-100 text-red-700 text-center font-semibold text-base"
        : "w-full px-4 py-2 rounded mb-3 bg-green-100 text-green-700 text-center font-semibold text-base"
    }
    style={{ letterSpacing: 0.2 }}
    role={type === "error" ? "alert" : "status"}
  >
    {children}
  </div>
);

const SellMedicinePage: React.FC = () => {
  // Data
  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [avail, setAvail] = useState<Record<string, MedicineAvailability>>({});
  // UI/interaction state
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState("");

  // NEW: state for form and bill messages
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [billSuccess, setBillSuccess] = useState<string | null>(null);

  // State for search UX
  const [medicineSearch, setMedicineSearch] = useState<string>("");
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load medicines and batch data
  async function fetchData() {
    setLoading(true);
    setFormError(null);
    setBillError(null);
    // Fetch medicines
    const { data: meds, error: medErr } = await supabase
      .from("medicines")
      .select("*")
      .order("name", { ascending: true });
    if (medErr || !meds) {
      setFormError("Unable to load medicines. Please try again.");
      setLoading(false);
      return;
    }
    setMedicines(meds);

    // Fetch batches with quantity_available > 0
    const { data: batchData, error: batchErr } = await supabase
      .from("inventory_batches")
      .select("*")
      .gt("quantity_available", 0);
    if (batchErr || !batchData) {
      setFormError("Unable to load inventory right now.");
      setLoading(false);
      return;
    }
    setBatches(batchData);
    setLoading(false);
  }

  // Build simple availability mapping for each medicine (non-expired stock only)
  function buildAvailability(
    medicines: Medicine[],
    batches: InventoryBatch[]
  ): Record<string, MedicineAvailability> {
    const map: Record<string, MedicineAvailability> = {};
    for (const med of medicines) {
      const related = batches.filter(
        (b) => b.medicine_id === med.id && !isBatchExpired(b.expiry_date)
      );
      const total = related.reduce((sum, b) => sum + b.quantity_available, 0);
      map[med.id] = {
        available: total,
        selling_price: med.selling_price,
        medicine_name: med.name,
      };
    }
    return map;
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    setAvail(buildAvailability(medicines, batches));
  }, [medicines, batches]);

  // When selectedMedicineId changes (by search picker), reset quantity, clear form messages, etc.
  useEffect(() => {
    setQuantity(1);
    setFormError(null);
    setFormSuccess(null);
    // When selected medicine changes via search, fill search field if needed
    if (selectedMedicineId) {
      // Find medicine name and fill search input
      const med = medicines.find(m => m.id === selectedMedicineId);
      if (med && med.name !== medicineSearch) {
        setMedicineSearch(med.name);
      }
      setShowResults(false);
    }
  // eslint-disable-next-line
  }, [selectedMedicineId]);

  // Close medicine result panel if medicineSearch is empty or medicine is selected
  useEffect(() => {
    if (!medicineSearch.trim() || selectedMedicineId) {
      setShowResults(false);
    }
  }, [medicineSearch, selectedMedicineId]);

  function allowedToAddStock(medicine_id: string) {
    const available = avail[medicine_id]?.available ?? 0;
    const alreadyAdded = cart.find(ci => ci.medicine_id === medicine_id)?.quantity ?? 0;
    return available - alreadyAdded;
  }

  function handleRemoveCartItem(medicine_id: string) {
    setCart((cart) => cart.filter(item => item.medicine_id !== medicine_id));
    setFormError(null);
    setFormSuccess(null);
    setBillError(null);
    setBillSuccess(null);
  }

  function handleAddToBill() {
    setFormError(null);
    setFormSuccess(null);

    if (!selectedMedicineId) {
      setFormError("Please select a medicine.");
      return;
    }
    if (!avail[selectedMedicineId]) {
      setFormError("No stock available.");
      return;
    }
    if (quantity < 1) {
      setFormError("Enter a valid quantity.");
      return;
    }
    const allowed = allowedToAddStock(selectedMedicineId);
    if (quantity > allowed) {
      setFormError(
        allowed <= 0
          ? "No more stock left."
          : `Only ${allowed} in stock.`
      );
      return;
    }

    setCart((old) => {
      const idx = old.findIndex((c) => c.medicine_id === selectedMedicineId);
      if (idx >= 0) {
        // Already in cart, increase quantity
        const newArr = [...old];
        const newQty = newArr[idx].quantity + quantity;
        newArr[idx] = {
          ...newArr[idx],
          quantity: newQty,
          line_total: newQty * avail[selectedMedicineId].selling_price
        };
        return newArr;
      }
      return [
        ...old,
        {
          medicine_id: selectedMedicineId,
          medicine_name: avail[selectedMedicineId].medicine_name,
          unit_price: avail[selectedMedicineId].selling_price,
          quantity,
          line_total: quantity * avail[selectedMedicineId].selling_price,
        }
      ];
    });
    setQuantity(1);
    setFormError(null);
    setFormSuccess("Added to bill.");
    setBillError(null);

    // Reset search field, medicine selection, and hide results
    setSelectedMedicineId("");
    setMedicineSearch("");
    setShowResults(false);
    // Refocus the search after add, if possible, for smoother UX
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 10);
  }

  const billTotal = useMemo(() => cart.reduce((sum, c) => sum + c.line_total, 0), [cart]);

  const canIncrease = selectedMedicineId
    ? allowedToAddStock(selectedMedicineId) > 0 && quantity < allowedToAddStock(selectedMedicineId)
    : false;

  async function handleSaveSale() {
    setBillError(null);
    setBillSuccess(null);
    setFormError(null);
    setFormSuccess(null);

    if (cart.length === 0) {
      setBillError("Add at least one medicine before saving.");
      return;
    }
    setSaving(true);

    const { data: batchesFresh, error: batchError } = await supabase
      .from("inventory_batches")
      .select("*")
      .gt("quantity_available", 0);

    if (batchError || !batchesFresh) {
      setBillError("Inventory could not be verified. Please try again.");
      setSaving(false);
      return;
    }

    type BatchDeduction = {
      batch_id: string;
      quantity: number;
      medicine_id: string;
      medicine_name: string;
      unit_price: number;
      line_total: number;
    };
    const batchDeductions: BatchDeduction[] = [];

    for (const item of cart) {
      const candidateBatches = batchesFresh
        .filter(
          (b: InventoryBatch) =>
            b.medicine_id === item.medicine_id &&
            !isBatchExpired(b.expiry_date) &&
            b.quantity_available > 0
        )
        .sort((a: InventoryBatch, b: InventoryBatch) =>
          a.expiry_date.localeCompare(b.expiry_date)
        );

      const totalAvailable = candidateBatches.reduce((sum, b) => sum + b.quantity_available, 0);
      if (item.quantity > totalAvailable) {
        setBillError(`Not enough stock for "${item.medicine_name}".`);
        setSaving(false);
        return;
      }

      let qtyNeeded = item.quantity;
      for (const batch of candidateBatches) {
        if (qtyNeeded === 0) break;
        const takingFromBatch = Math.min(qtyNeeded, batch.quantity_available);

        batchDeductions.push({
          batch_id: batch.id,
          quantity: takingFromBatch,
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          unit_price: item.unit_price,
          line_total: takingFromBatch * item.unit_price
        });

        qtyNeeded -= takingFromBatch;
      }
    }

    const { data: insertSale, error: saleErr } = await supabase
      .from("sales")
      .insert([
        {
          customer_name: customerName.trim() ? customerName.trim() : null,
          total_amount: billTotal,
          sold_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();
    if (saleErr || !insertSale) {
      setBillError("Could not save sale. Please try again.");
      setSaving(false);
      return;
    }
    const sale_id = insertSale.id;

    const saleItemsToInsert = batchDeductions.map(ded => ({
      sale_id,
      medicine_id: ded.medicine_id,
      batch_id: ded.batch_id,
      medicine_name: ded.medicine_name,
      quantity: ded.quantity,
      unit_price: ded.unit_price,
      line_total: ded.line_total,
    }));

    const { error: saleItemsErr } = await supabase
      .from("sale_items")
      .insert(saleItemsToInsert);

    if (saleItemsErr) {
      setBillError("Could not complete sale. Please try again.");
      setSaving(false);
      return;
    }

    for (const deduction of batchDeductions) {
      const batch = batchesFresh.find((b: InventoryBatch) => b.id === deduction.batch_id);
      if (!batch) continue;
      const newQty = batch.quantity_available - deduction.quantity;
      const result = await supabase
        .from("inventory_batches")
        .update({ quantity_available: newQty })
        .eq("id", deduction.batch_id);
      if (result.error) {
        setBillError("Could not update inventory.");
        setSaving(false);
        return;
      }
    }

    setCart([]);
    setCustomerName("");
    setSelectedMedicineId("");
    setQuantity(1);
    await fetchData();
    setBillSuccess("Sale saved.");
    setBillError(null);
    setFormError(null);
    setFormSuccess(null);
    setSaving(false);
  }

  // Filter medicines by search text (case-insensitive, simple substring match)
  const filteredMedicines = useMemo(() => {
    if (!medicineSearch.trim() || medicines.length === 0) return [];
    const lower = medicineSearch.trim().toLowerCase();
    // Filter only medicines with non-expired & available > 0 for user clarity
    return medicines
      .filter(med => {
        // Show all medicines if match, regardless of availability, but highlight those with available > 0
        return med.name.toLowerCase().includes(lower);
      })
      .slice(0, 8); // max 8 shown
  }, [medicineSearch, medicines]);

  // Find the selected medicine object for summary panel
  const selectedMedicine = selectedMedicineId
    ? medicines.find(m => m.id === selectedMedicineId)
    : null;

  const selectedAvail = selectedMedicineId
    ? avail[selectedMedicineId]
    : undefined;

  // Handlers for medicine search interaction
  function handleSearchInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMedicineSearch(e.target.value);
    setSelectedMedicineId(""); // When user types, unselect any current medicine
    setShowResults(true);
    setFormError(null);
    setFormSuccess(null);
  }

  // Handle focus to expand the result list
  function handleSearchFocus() {
    if (medicineSearch.trim()) setShowResults(true);
  }

  // Clicking a result item
  function handleSelectMedicine(medId: string, medName: string) {
    setSelectedMedicineId(medId);
    setMedicineSearch(medName);
    setShowResults(false);
  }

  // Handle Enter on the input (select first match)
  function handleSearchInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (filteredMedicines.length > 0) {
        const med = filteredMedicines[0];
        setSelectedMedicineId(med.id);
        setMedicineSearch(med.name);
        setShowResults(false);
        // Prevent accidental form submit if any
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  }

  // Hide results panel if clicked outside
  useEffect(() => {
    if (!showResults) return;
    function handler(ev: MouseEvent) {
      // Only close if click is outside the search input or results
      if (!searchInputRef.current) return;
      const searchBox = searchInputRef.current;
      if (searchBox && ev.target instanceof Node && !searchBox.parentElement?.contains(ev.target)) {
        setShowResults(false);
      }
    }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showResults]);

  return (
    <div className="min-h-screen bg-[#f6f8fb] pb-[120px]">
      <div className="max-w-[430px] mx-auto flex flex-col min-h-screen">
        <PageHeader
          title="Sell Medicine"
          subtitle="Search medicine and add quantity"
        />

        <Card className="flex flex-col gap-6 mt-4 mb-4 px-2 py-5">
          {loading ? (
            <div className="text-gray-500 text-center text-lg py-8">
              Loading medicines...
            </div>
          ) : (
            <>
              {/* FORM MESSAGES: show error or success above form section */}
              {formError && <FormMessage type="error">{formError}</FormMessage>}
              {formSuccess && <FormMessage type="success">{formSuccess}</FormMessage>}

              <div className="flex flex-col gap-2">
                <label htmlFor="medicine-search" className="text-base font-medium mb-0.5">
                  Search Medicine
                </label>
                <div className="relative w-full">
                  <input
                    id="medicine-search"
                    ref={searchInputRef}
                    type="text"
                    autoComplete="off"
                    value={medicineSearch}
                    onChange={handleSearchInputChange}
                    onFocus={handleSearchFocus}
                    onKeyDown={handleSearchInputKeyDown}
                    placeholder="Type medicine name"
                    className="text-lg py-4 px-4 rounded-md border border-gray-300 focus:outline-none bg-white w-full"
                    spellCheck={false}
                  />
                  {showResults && medicineSearch.trim() && (
                    <div
                      className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-y-auto"
                      style={{ minWidth: "100%" }}
                    >
                      {filteredMedicines.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-base">
                          No matching medicines
                        </div>
                      ) : (
                        filteredMedicines.map((med) => {
                          const availability = avail[med.id];
                          return (
                            <button
                              type="button"
                              key={med.id}
                              className="
                                w-full text-left px-4 py-3 flex flex-row items-center gap-3
                                hover:bg-blue-50 hover:text-blue-800 focus:outline-none transition
                                border-b border-slate-100 last:border-b-0
                                "
                              style={{ cursor: "pointer" }}
                              onClick={() => handleSelectMedicine(med.id, med.name)}
                            >
                              <span className="flex-1 font-semibold text-base truncate" title={med.name}>
                                {med.name}
                              </span>
                              <span className="inline-block text-xs font-semibold rounded px-2 py-1 bg-blue-100 text-blue-700 min-w-[62px] text-center ml-2">
                                {typeof availability?.available === "number" ? `Avail: ${availability.available}` : "No Stock"}
                              </span>
                              <span className="inline-block text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded ml-2 min-w-[60px] text-center">
                                ₹{typeof availability?.selling_price === "number" ? formatNumber(availability.selling_price) : "N/A"}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Summary for selected medicine */}
                  {selectedMedicine && selectedAvail && (
                    <div className="rounded-md px-4 py-3 mt-2 bg-blue-50 border border-blue-200">
                      <div className="text-lg font-bold text-blue-900">{selectedAvail.medicine_name}</div>
                      <div className="text-base text-blue-700 font-medium mt-1">
                        Available: <span className="font-bold">{selectedAvail.available}</span>
                      </div>
                      <div className="text-base text-blue-700 font-medium">
                        Price: <span className="font-bold">&#8377;{formatNumber(selectedAvail.selling_price)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-base font-medium mb-0.5">
                  Quantity
                </label>
                <div className="flex flex-row items-center justify-center gap-4 mt-2">
                  {/* Minus Button */}
                  <Button
                    className="w-16 h-16 rounded-full flex items-center justify-center text-4xl font-extrabold bg-neutral-200 hover:bg-neutral-300 active:bg-neutral-400 text-neutral-700 shadow transition duration-100"
                    style={{
                      minWidth: 64,
                      minHeight: 64,
                      fontSize: 40,
                      border: "none",
                      padding: 0,
                      boxShadow: "0 2px 8px 0 rgba(60,60,80,0.03)"
                    }}
                    variant="secondary"
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1 || !selectedMedicineId}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    type="button"
                  >
                    –
                  </Button>
                  {/* Quantity Number */}
                  <span
                    className="select-none font-extrabold text-[2.5rem] text-gray-900 px-6"
                    style={{
                      minWidth: 64,
                      textAlign: "center",
                      letterSpacing: 1,
                      userSelect: "none"
                    }}
                  >
                    {quantity}
                  </span>
                  {/* Plus Button */}
                  <Button
                    className="w-16 h-16 rounded-full flex items-center justify-center text-4xl font-extrabold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow transition duration-100"
                    style={{
                      minWidth: 64,
                      minHeight: 64,
                      fontSize: 40,
                      border: "none",
                      padding: 0,
                      boxShadow: "0 2px 8px 0 rgba(40,90,220,0.06)"
                    }}
                    variant="primary"
                    aria-label="Increase quantity"
                    disabled={!canIncrease}
                    onClick={() => setQuantity((q) => q + 1)}
                    type="button"
                  >
                    +
                  </Button>
                </div>
              </div>
              <Button
                fullWidth
                className="mt-6 mb-0 py-5 text-xl font-extrabold rounded-xl shadow-lg transition
                  bg-gradient-to-r from-blue-700 to-blue-500
                  hover:from-blue-800 hover:to-blue-600
                  active:from-blue-900 active:to-blue-700
                  text-white border-0 focus:outline-none focus:ring-4 focus:ring-blue-200"
                style={{
                  letterSpacing: 1,
                  boxShadow: "0 4px 16px 0 rgba(36, 68, 180, 0.10)"
                }}
                variant="primary"
                onClick={handleAddToBill}
                disabled={
                  !selectedMedicineId ||
                  quantity < 1 ||
                  !avail[selectedMedicineId] ||
                  allowedToAddStock(selectedMedicineId) <= 0
                }
                type="button"
              >
                Add to Bill
              </Button>
            </>
          )}
        </Card>

        {/* Current Bill Section */}
        <Card className="mt-1 mb-4 px-4 py-5 flex flex-col gap-4 bg-white shadow">
          <div className="text-xl font-bold mb-1">Current Bill</div>
          {/* BILL MESSAGES: show error or success above bill section */}
          {billError && <BillMessage type="error">{billError}</BillMessage>}
          {billSuccess && <BillMessage type="success">{billSuccess}</BillMessage>}
          {cart.length === 0 ? (
            <>
              <div className="flex flex-col items-center justify-center min-h-[90px] text-[#b0bbc6] text-lg font-medium text-center">
                <span className="opacity-90">No medicines have been added yet</span>
              </div>
              <div className="flex justify-end pt-3 mt-2 border-t border-slate-200">
                <span
                  className="text-lg font-bold text-slate-600"
                  style={{
                    letterSpacing: 0.5,
                  }}
                >
                  Total:{" "}
                  <span
                    className="text-2xl font-extrabold text-slate-700"
                    style={{
                      paddingLeft: 8,
                    }}
                  >
                    ₹0.00
                  </span>
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-4 mb-2">
                {cart.map((ci) => (
                  <div
                    key={ci.medicine_id}
                    className="flex flex-row justify-between items-center bg-[#f7fafc] rounded-lg px-3 py-3 shadow-sm border border-slate-100"
                  >
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <div className="font-semibold text-base truncate" title={ci.medicine_name}>
                        {ci.medicine_name}
                      </div>
                      <div className="text-gray-500 text-xs leading-tight mt-0.5">
                        Qty: <span className="font-semibold">{ci.quantity}</span>
                        {" "} &times;{" "}
                        <span className="font-mono">&#8377;{formatNumber(ci.unit_price)}</span>
                      </div>
                    </div>
                    <div className="flex flex-row items-end gap-2 ml-4">
                      <div className="font-semibold text-lg min-w-[70px] text-right">
                        &#8377;{formatNumber(ci.line_total)}
                      </div>
                      <Button
                        variant="secondary"
                        className="ml-2 px-2 py-1 rounded bg-transparent text-red-400 border border-transparent hover:bg-red-50 hover:text-red-600 transition text-xs font-semibold"
                        style={{ minWidth: 0, height: 28, lineHeight: 1, padding: "4px 10px" }}
                        onClick={() => handleRemoveCartItem(ci.medicine_id)}
                        type="button"
                        aria-label={`Remove ${ci.medicine_name}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-3 mt-2 border-t border-slate-200">
                <span
                  className="text-lg font-bold text-slate-600"
                  style={{
                    letterSpacing: 0.5,
                  }}
                >
                  Total:{" "}
                  <span
                    className="text-2xl font-extrabold text-blue-700"
                    style={{
                      paddingLeft: 8,
                    }}
                  >
                    ₹{formatNumber(billTotal)}
                  </span>
                </span>
              </div>
            </>
          )}
        </Card>

        <Card className="mt-4 mb-0 px-3 py-6 flex flex-col gap-6 bg-white shadow-lg">
          <Input
            label="Customer Name (optional)"
            id="customerName"
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="py-4 px-4 rounded-md border border-gray-300 text-lg w-full"
            placeholder="Enter customer name"
            containerClassName="w-full"
          />
          <Button
            fullWidth
            className="text-2xl py-5 font-extrabold rounded-xl shadow-lg"
            style={{
              background: "#22bb66",
              color: "#fff",
              border: "none",
              letterSpacing: 1,
              boxShadow: "0 4px 16px 0 rgba(38,210,120,0.08)"
            }}
            onClick={handleSaveSale}
            disabled={saving || cart.length === 0}
          >
            {saving ? "Saving..." : "Save Sale"}
          </Button>
        </Card>
        <div className="h-28" />
      </div>
    </div>
  );
};

export default SellMedicinePage;
