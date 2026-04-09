Medicine Shop Inventory Manager

A simple, mobile-friendly inventory + billing app for small medicine shops.

Live App:
https://pharmacy-shop-inventory-manager.vercel.app/

What this does?

Built this to simulate a real shop counter system where you can:

➕ Add medicines
📦 Add stock (batch + expiry based internally)
💊 Sell medicines (auto stock deduction)
⚠️ Get alerts for low stock / expiry
📊 See dashboard stats
🧾 View sales history

Everything is designed to be simple, fast, and usable by non-technical shopkeepers.

Key idea :

  Even though stock is stored in batches internally, the UI keeps it simple:
  
  - No batch selection while selling
  - System automatically picks:
  - non-expired stock
  - earliest expiry first

  Tech Stack : 
  
  - React + Vite + TypeScript
  - Tailwind CSS
  - Supabase (Database)
  - Deployed on Vercel

  Features :
  
  - Mobile-first UI (big buttons, clean layout)
  - Smart stock deduction (FIFO based on expiry)
  - Real-time dashboard + alerts
  - Simple billing flow
  - No unnecessary complexity

  Notes :
  
  - No authentication (single-user style app)
  - No barcode / PDF / analytics yet
  - Focus was on core functionality working properly
