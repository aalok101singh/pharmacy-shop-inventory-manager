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
};

type SaleItem = {
  id: string;
  sale_id: string;
  medicine_id: string;
  medicine_name: string;
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

const HistoryPage: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [itemsBySaleId, setItemsBySaleId] = useState<Record<string, SaleItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError(null);
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
        // Defensive: supabase .in fails with empty array, but we checked for >0 rows
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
        setError("Could not fetch sales history.");
        setSales([]);
        setItemsBySaleId({});
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

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
      ) : error ? (
        <Card
          style={{
            padding: "28px 18px",
            borderRadius: 16,
            textAlign: "center",
          }}
        >
          <div className="text-lg text-red-600 font-semibold mb-2">{error}</div>
        </Card>
      ) : sales.length === 0 ? (
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
              }}
            >
              <div className="flex flex-col gap-1 mb-1">
                <div className="flex flex-row justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-gray-500">
                    {formatDateTime(sale.sold_at)}
                  </span>
                  <span
                    className="font-bold text-lg"
                    style={{ color: "#18985c", letterSpacing: 1 }}
                  >
                    {formatCurrency(sale.total_amount)}
                  </span>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;