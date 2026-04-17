import React, { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import { supabase } from "../lib/supabase";

// Types for local clarity
type Sale = {
  id: string;
  customer_name: string | null;
  total_amount: number;
  sold_at: string;
  is_cancelled?: boolean;
};

type SaleItem = {
  id: string;
  sale_id: string;
  medicine_id: string;
  medicine_name: string;
  batch_id?: string | null; // Used for stock adjustments
  quantity: number;
  unit_price: number;
  line_total: number;
};

// Simple date+time formatter, fallback to raw string
function formatDateTime(str: string) {
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Simple Indian number formatter with ₹
function formatCurrency(n: number | null | undefined) {
  if (typeof n !== "number" || isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// --- Simple status badge component ---
function SaleStatusBadge({ is_cancelled }: { is_cancelled?: boolean }) {
  if (!is_cancelled) return null;
  return (
    <span
      className="ml-2 select-none"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        color: "#c62828",
        background: "#ffeaea",
        fontWeight: 600,
        padding: "2.5px 11px",
        borderRadius: 8,
        fontSize: "0.93rem",
        lineHeight: 1.3,
        letterSpacing: 0.2,
        minWidth: 0,
      }}
      aria-label="Cancelled"
      title="Cancelled"
    >
      Cancelled
    </span>
  );
}

const HistoryPage: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [itemsBySaleId, setItemsBySaleId] = useState<Record<string, SaleItem[]>>({});
  const [loading, setLoading] = useState(true);
  // Rewritten error state per requirements:
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line
  }, []);

  async function fetchHistory() {
    setLoading(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      // Fetch all sales, latest first
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .order("sold_at", { ascending: false });
      if (salesError) throw salesError;

      if (!salesData || salesData.length === 0) {
        setSales([]);
        setItemsBySaleId({});
        setLoading(false);
        return;
      }

      setSales(salesData as Sale[]);

      // Fetch sale_items for all sale ids
      const saleIds = salesData.map((s: Sale) => s.id);
      const { data: saleItemsData, error: saleItemsError } = await supabase
        .from("sale_items")
        .select("*")
        .in("sale_id", saleIds);
      if (saleItemsError) throw saleItemsError;

      // Group sale items by sale_id
      const bySale: Record<string, SaleItem[]> = {};
      (saleItemsData || []).forEach((item: SaleItem) => {
        if (!bySale[item.sale_id]) bySale[item.sale_id] = [];
        bySale[item.sale_id].push(item);
      });
      setItemsBySaleId(bySale);
    } catch (e: any) {
      setErrorMessage("Could not fetch sales history.");
      setSales([]);
      setItemsBySaleId({});
    } finally {
      setLoading(false);
    }
  }

  // Sale cancellation (Restore only by sale_items.batch_id, error handling is non-blocking)
  async function handleCancelSale(sale: Sale) {
    setMessage(null);
    setErrorMessage(null);

    if (sale.is_cancelled) {
      setMessage("This sale has already been cancelled.");
      return;
    }

    setCancellingSaleId(sale.id);

    try {
      // 1. Fetch all sale_items for this sale
      const { data: saleItemsData, error: saleItemsError } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id);

      if (saleItemsError || !saleItemsData || !Array.isArray(saleItemsData) || saleItemsData.length === 0) {
        setErrorMessage("Something went wrong while cancelling the sale. Please try again.");
        return;
      }

      // 2. For each item, restore stock to the original batch using batch_id
      for (let i = 0; i < saleItemsData.length; i++) {
        const item = saleItemsData[i];
        const batchId = item.batch_id;
        const qtyToRestore = Number(item.quantity) || 0;

        // batch_id is required for stock restore; if not present, error
        if (!batchId) {
          setErrorMessage("Something went wrong while cancelling the sale. Please try again.");
          return;
        }

        // Fetch the batch BY ID as source of truth
        const { data: batchData, error: batchError } = await supabase
          .from("inventory_batches")
          .select("id, quantity_available")
          .eq("id", batchId)
          .single();

        if (batchError || !batchData) {
          setErrorMessage("Something went wrong while cancelling the sale. Please try again.");
          return;
        }

        const newQty = (Number(batchData.quantity_available) || 0) + qtyToRestore;

        // Update quantity_available of this batch
        const { error: updateError } = await supabase
          .from("inventory_batches")
          .update({ quantity_available: newQty })
          .eq("id", batchId);

        if (updateError) {
          setErrorMessage("Something went wrong while cancelling the sale. Please try again.");
          return;
        }
      }

      // 3. Mark the sale as cancelled after restoring all stock
      const { error: saleUpdateErr } = await supabase
        .from("sales")
        .update({ is_cancelled: true })
        .eq("id", sale.id);

      if (saleUpdateErr) {
        setErrorMessage("Something went wrong while cancelling the sale. Please try again.");
        return;
      }

      setMessage("Sale cancelled and stock restored successfully.");
      await fetchHistory();
    } catch (e: any) {
      setErrorMessage("Something went wrong while cancelling the sale. Please try again.");
    } finally {
      setCancellingSaleId(null);
    }
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
        title="History"
        subtitle="Past sales and bills"
        className="mt-[36px] mb-7"
      />

      {/* Dismissible error box for non-blocking error */}
      {errorMessage && (
        <Card
          style={{
            background: "#fecaca",
            borderRadius: 10,
            marginBottom: 14,
            textAlign: "center",
            padding: "13px 10px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14
          }}
        >
          <span className="text-red-700 text-sm" style={{ flex: 1 }}>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="bg-[#d32f2f] hover:bg-[#b71c1c] text-white rounded px-4 py-1 text-sm font-semibold ml-4 transition-all"
            style={{
              minWidth: 66
            }}
            aria-label="Dismiss error"
          >
            OK
          </button>
        </Card>
      )}

      {loading ? (
        <Card
          style={{
            padding: "28px 18px",
            borderRadius: 16,
            textAlign: "center",
          }}
        >
          <div className="text-lg text-gray-800 font-semibold mb-2">Loading...</div>
        </Card>
      ) : (
        <>
          {message && (
            <Card
              style={{
                background: "#dcfce7",
                borderRadius: 10,
                marginBottom: 10,
                textAlign: "center",
                padding: "12px 10px",
              }}
            >
              <span className="text-green-800 text-sm">{message}</span>
            </Card>
          )}
          {sales.length === 0 ? (
            <Card
              style={{
                padding: "28px 18px",
                borderRadius: 16,
                textAlign: "center",
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 10, color: "#222" }}>
                No sales yet
              </h2>
              <div style={{ color: "#888", fontSize: 16 }}>
                Saved sales will appear here
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-4 pb-2">
              {sales.map((sale) => (
                <Card
                  key={sale.id}
                  className="mb-3"
                  style={{
                    padding: "20px 16px",
                    borderRadius: 16,
                    background: "#fff",
                    boxShadow: "0 0 0 1px #eee",
                    opacity: sale.is_cancelled ? 0.62 : 1,
                    position: "relative",
                  }}
                >
                  {/* Sale metadata and status row */}
                  <div className="flex flex-col gap-1 mb-1">
                    {/* Date/amount/status group, pulls badge and amount together on mobile */}
                    <div className="flex flex-row justify-between items-end mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-500">
                        {formatDateTime(sale.sold_at)}
                      </span>
                      <div className="flex flex-row items-center">
                        <span
                          className="font-bold text-lg"
                          style={{
                            color: sale.is_cancelled ? "#ce2020" : "#18985c",
                            letterSpacing: 1,
                          }}
                        >
                          {formatCurrency(sale.total_amount)}
                        </span>
                        <SaleStatusBadge is_cancelled={sale.is_cancelled} />
                      </div>
                    </div>
                    <div className="text-base font-medium text-gray-700 mb-0.5">
                      {sale.customer_name?.trim()
                        ? sale.customer_name
                        : "Walk-in customer"}
                    </div>
                  </div>
                  <div
                    className="bg-[#f9fbfd] rounded-md p-2 pt-2.5 pb-0.5 mt-2 mb-1"
                    style={{ fontSize: "15px" }}
                  >
                    {(itemsBySaleId[sale.id] || []).length > 0 ? (
                      itemsBySaleId[sale.id].map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-row justify-between items-center border-b last:border-none border-gray-100 py-1"
                        >
                          <div>
                            <div className="font-semibold text-gray-800">
                              {item.medicine_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {item.quantity} x{" "}
                              <span className="font-mono">
                                ₹{item.unit_price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                          <div className="font-bold text-[#143] text-base ml-2 whitespace-nowrap">
                            ₹{item.line_total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-400 text-sm py-2">
                        No items
                      </div>
                    )}
                  </div>
                  {/* Cancelled Label or Cancel Sale Button */}
                  <div className="flex flex-row justify-between items-center mt-2">
                    {sale.is_cancelled ? (
                      <span aria-label="Cancelled" className="select-none" style={{ minHeight: 32 }}></span>
                    ) : (
                      <button
                        className="text-white bg-[#d32f2f] hover:bg-[#b71c1c] font-semibold px-4 py-1.5 rounded transition-all text-sm"
                        style={{
                          minWidth: 120,
                          opacity: cancellingSaleId === sale.id ? 0.6 : 1,
                          cursor: cancellingSaleId === sale.id ? "wait" : "pointer",
                        }}
                        disabled={cancellingSaleId === sale.id}
                        onClick={() => handleCancelSale(sale)}
                      >
                        {cancellingSaleId === sale.id ? "Cancelling..." : "Cancel Sale"}
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HistoryPage;