import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import { supabase } from "../lib/supabase";
import type { Medicine, InventoryBatch } from "../types/database";

// Helper for formatting dates as dd MMM yyyy
function formatDate(str: string) {
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Alert groups
  const [lowStock, setLowStock] = useState<{ medicine: Medicine; available: number }[]>([]);
  const [outOfStock, setOutOfStock] = useState<Medicine[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<{ batch: InventoryBatch; medicine: Medicine }[]>([]);

  useEffect(() => {
    async function fetchAlertsData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch all medicines
        const { data: medicinesData, error: medicinesError } = await supabase.from("medicines").select("*");
        if (medicinesError) throw medicinesError;
        // Fetch all batches
        const { data: batchesData, error: batchesError } = await supabase.from("inventory_batches").select("*");
        if (batchesError) throw batchesError;

        const medicines: Medicine[] = medicinesData || [];
        const batches: InventoryBatch[] = batchesData || [];

        // Only consider non-expired batches
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // For each medicine, sum up the non-expired, available amounts
        const medicineAvailableMap: Record<string, number> = {};
        medicines.forEach((med) => {
          const qty = batches
            .filter(
              (batch) =>
                batch.medicine_id === med.id &&
                batch.quantity_available > 0 &&
                new Date(batch.expiry_date) >= today
            )
            .reduce((sum, batch) => sum + batch.quantity_available, 0);
          medicineAvailableMap[med.id] = qty;
        });

        // ---- Low Stock and Out of Stock ----
        const lowStockArr: { medicine: Medicine; available: number }[] = [];
        const outOfStockArr: Medicine[] = [];
        medicines.forEach((med) => {
          const qty = medicineAvailableMap[med.id] || 0;
          if (qty > 0 && qty <= med.minimum_stock) {
            lowStockArr.push({ medicine: med, available: qty });
          }
          if (qty === 0) {
            outOfStockArr.push(med);
          }
        });

        // ---- Expiring Soon (next 30 days, non-expired, qty > 0) ----
        const soonDate = new Date(today);
        soonDate.setDate(today.getDate() + 30);
        const expiringSoonArr: { batch: InventoryBatch; medicine: Medicine }[] = [];
        batches.forEach((batch) => {
          const expiryDateObj = new Date(batch.expiry_date);
          if (batch.quantity_available > 0 && expiryDateObj >= today && expiryDateObj <= soonDate) {
            const med = medicines.find((m) => m.id === batch.medicine_id);
            if (med) {
              expiringSoonArr.push({ batch, medicine: med });
            }
          }
        });

        setLowStock(lowStockArr);
        setOutOfStock(outOfStockArr);
        setExpiringSoon(expiringSoonArr);
      } catch (err: any) {
        setError("There was a problem loading alerts. Try refreshing the page.");
      } finally {
        setLoading(false);
      }
    }
    fetchAlertsData();
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
        title="Alerts"
        subtitle="Low stock, out of stock, and expiring soon"
        className="mt-9 mb-7"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* LOW STOCK */}
        <Card
          style={{
            borderLeft: "6px solid #facc15",
            borderRadius: 16,
            background: "#fefce8",
            padding: "22px 18px",
            marginBottom: 4,
          }}
        >
          <h3
            style={{
              fontWeight: 600,
              fontSize: 18,
              color: "#854d0e",
              marginBottom: 8,
            }}
          >
            Low Stock
          </h3>
          {loading ? (
            <div style={{ color: "#a16207", fontSize: 15 }}>Loading...</div>
          ) : error ? (
            <div style={{ color: "#a16207", fontSize: 15 }}>{error}</div>
          ) : lowStock.length === 0 ? (
            <div style={{ color: "#a16207", fontSize: 15 }}>
              All medicines are sufficiently stocked.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lowStock.map(({ medicine, available }) => (
                <div
                  key={medicine.id}
                  style={{
                    background: "#fffbe8",
                    borderRadius: 10,
                    padding: "14px 14px",
                    display: "flex",
                    flexDirection: "column",
                    border: "1px solid #fde047",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 16,
                      color: "#92400e",
                      marginBottom: 2,
                    }}
                  >
                    {medicine.name}
                  </div>
                  <div style={{ fontSize: 14, color: "#854d0e" }}>
                    {available} in stock (minimum is {medicine.minimum_stock})
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* OUT OF STOCK */}
        <Card
          style={{
            borderLeft: "6px solid #f87171",
            borderRadius: 16,
            background: "#fef2f2",
            padding: "22px 18px",
            marginBottom: 4,
          }}
        >
          <h3
            style={{
              fontWeight: 600,
              fontSize: 18,
              color: "#b91c1c",
              marginBottom: 8,
            }}
          >
            Out of Stock
          </h3>
          {loading ? (
            <div style={{ color: "#dc2626", fontSize: 15 }}>Loading...</div>
          ) : error ? (
            <div style={{ color: "#dc2626", fontSize: 15 }}>{error}</div>
          ) : outOfStock.length === 0 ? (
            <div style={{ color: "#dc2626", fontSize: 15 }}>
              All medicines are in stock.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {outOfStock.map((medicine) => (
                <div
                  key={medicine.id}
                  style={{
                    background: "#fff1f2",
                    borderRadius: 10,
                    padding: "14px 14px",
                    border: "1px solid #fca5a5",
                    fontWeight: 500,
                    color: "#b91c1c",
                    fontSize: 16,
                  }}
                >
                  {medicine.name}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* EXPIRING SOON */}
        <Card
          style={{
            borderLeft: "6px solid #38bdf8",
            borderRadius: 16,
            background: "#eef6fb",
            padding: "22px 18px",
          }}
        >
          <h3
            style={{
              fontWeight: 600,
              fontSize: 18,
              color: "#1e40af",
              marginBottom: 8,
            }}
          >
            Expiring Soon
          </h3>
          {loading ? (
            <div style={{ color: "#2563eb", fontSize: 15 }}>Loading...</div>
          ) : error ? (
            <div style={{ color: "#2563eb", fontSize: 15 }}>{error}</div>
          ) : expiringSoon.length === 0 ? (
            <div style={{ color: "#2563eb", fontSize: 15 }}>
              No medicines are expiring soon.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {expiringSoon.map(({ batch, medicine }) => (
                <div
                  key={batch.id}
                  style={{
                    background: "#e0f2fe",
                    borderRadius: 10,
                    padding: "14px 14px",
                    border: "1px solid #7dd3fc",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 16,
                      color: "#1e3a8a",
                    }}
                  >
                    {medicine.name}
                  </div>
                  <div style={{ fontSize: 14, color: "#2563eb" }}>
                    Batch{" "}
                    <span style={{ fontFamily: "monospace" }}>
                      {batch.batch_number}
                    </span>
                    {" · "}expires on {formatDate(batch.expiry_date)}
                  </div>
                  <div style={{ fontSize: 14, color: "#166da3" }}>
                    {batch.quantity_available} in this batch
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}