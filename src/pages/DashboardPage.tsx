import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";

// Simple number formatter with ₹, fallback to `0` if not number
function formatCurrency(n: number | null | undefined) {
  if (typeof n !== "number" || isNaN(n)) return "₹0";
  return `₹${n.toLocaleString()}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [medicines, setMedicines] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [todaySales, setTodaySales] = useState<number>(0);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        // Get medicines
        const { data: meds, error: errMeds } = await supabase
          .from("medicines")
          .select("*");
        if (errMeds) throw errMeds;

        // Get batches
        const { data: bats, error: errBats } = await supabase
          .from("inventory_batches")
          .select("*");
        if (errBats) throw errBats;

        // Today's date boundaries local
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        // Get sales (all, filter by JS)
        const { data: salesRows, error: salesErr } = await supabase
          .from("sales")
          .select("total_amount, sold_at");
        if (salesErr) throw salesErr;

        setMedicines(meds ?? []);
        setBatches(bats ?? []);

        // Sum today's sales total_amount (sold_at within boundaries)
        let todaySum = 0;
        (salesRows ?? []).forEach((row) => {
          if (!row.sold_at) return;
          const saleDate = new Date(row.sold_at);
          if (saleDate >= startOfDay && saleDate <= endOfDay && typeof row.total_amount === "number") {
            todaySum += row.total_amount;
          }
        });
        setTodaySales(todaySum);
      } catch (err) {
        setError("Could not load dashboard data.");
      }
      setLoading(false);
    }
    fetchAll();
  }, []);

  // Batch is expired?
  function isBatchExpired(batch: { expiry_date: string | null }) {
    if (!batch || !batch.expiry_date) return true;
    const expDate = new Date(batch.expiry_date);
    expDate.setHours(23, 59, 59, 999);
    return expDate < new Date();
  }

  // Batch is expiring in next 30 days & not expired
  function isBatchExpiringSoon(batch: { expiry_date: string | null }) {
    if (!batch || !batch.expiry_date) return false;
    const now = new Date();
    const expDate = new Date(batch.expiry_date);
    expDate.setHours(23, 59, 59, 999);
    const days = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }

  // -- Dashboard Calculations --
  let totalMedicines = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let expiringSoon = 0;

  if (!loading && !error && medicines.length > 0) {
    totalMedicines = medicines.length;
    medicines.forEach((med) => {
      // All non-expired batches for this med
      const medBatches = batches.filter(
        (b) => b.medicine_id === med.id && !isBatchExpired(b)
      );
      const available = medBatches.reduce(
        (sum, b) => sum + (typeof b.quantity_available === "number" ? b.quantity_available : 0),
        0
      );
      if (available === 0) {
        outOfStock++;
      } else if (
        available > 0 &&
        available <= (typeof med.minimum_stock === "number" ? med.minimum_stock : 0)
      ) {
        lowStock++;
      }
      // At least one non-expired batch expiring soon and has stock
      if (
        medBatches.some(
          (b) =>
            isBatchExpiringSoon(b) &&
            typeof b.quantity_available === "number" &&
            b.quantity_available > 0
        )
      ) {
        expiringSoon++;
      }
    });
  }

  // Stat cards list, in order
  const stats = [
    {
      label: "Total Medicines",
      value: loading ? "..." : error ? "-" : totalMedicines.toLocaleString(),
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      label: "Low Stock",
      value: loading ? "..." : error ? "-" : lowStock.toLocaleString(),
      color: "text-yellow-700",
      bg: "bg-yellow-50",
    },
    {
      label: "Out of Stock",
      value: loading ? "..." : error ? "-" : outOfStock.toLocaleString(),
      color: "text-red-700",
      bg: "bg-red-50",
    },
    {
      label: "Expiring Soon",
      value: loading ? "..." : error ? "-" : expiringSoon.toLocaleString(),
      color: "text-orange-800",
      bg: "bg-orange-50",
    },
    {
      label: "Today Sales",
      value: loading
        ? "..."
        : error
        ? "-"
        : formatCurrency(todaySales),
      color: "text-green-700",
      bg: "bg-green-50",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Dashboard" subtitle="Quick view of your medicine shop" />

      {error ? (
        <div className="text-center text-red-500 pt-6">Failed to load data.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className={`flex flex-col items-center ${stat.bg} p-4 shadow-sm`}
            >
              <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 mt-6">
        <Button
          fullWidth
          variant="primary"
          className="text-lg py-4"
          onClick={() => navigate("/sell")}
        >
          Sell Medicine
        </Button>
        <Button
          fullWidth
          variant="secondary"
          className="bg-green-600 hover:bg-green-700 text-lg py-4 text-white"
          onClick={() => navigate("/stock")}
        >
          Add Stock
        </Button>
      </div>
    </div>
  );
}