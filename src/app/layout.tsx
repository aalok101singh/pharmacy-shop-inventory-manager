import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Sell", to: "/sell" },
  { label: "Stock", to: "/stock" },
  { label: "Medicines", to: "/medicines" },
  { label: "Alerts", to: "/alerts" },
  { label: "History", to: "/history" },
];

// Match actual nav height for proper main bottom padding (adjust as nav spacing changes)
const BOTTOM_NAV_HEIGHT = 64; // px; robust for 3 lines + shadow

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="w-full bg-white shadow-sm border-b">
        <div className="mx-auto max-w-md px-4 pb-3 pt-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-0.5">
            Medicine Inventory Manager
          </h1>
          <span className="block text-[1rem] text-slate-500 tracking-tight">
            
          </span>
        </div>
      </header>
      <main
        className="flex-1 mx-auto w-full max-w-md bg-white px-4 pt-6 pb-2"
        style={{
          // Ensure absolutely nothing gets hidden by bottom nav
          paddingBottom: `max(2.5rem, ${BOTTOM_NAV_HEIGHT + 12}px)`,
        }}
      >
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-sm z-20">
        <div className="mx-auto w-full max-w-md px-[2px] py-2 flex flex-row gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  // Flex grow allows all tabs to take equal available width
                  "flex-1 flex items-center justify-center rounded-lg py-2 px-0 transition-colors duration-100",
                  // Typography and white-space
                  "font-medium text-[0.93rem] sm:text-base leading-tight whitespace-nowrap",
                  // Explicitly prevent truncation
                  isActive
                    ? "bg-blue-600 text-white shadow font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-blue-100"
                ].join(" ")
              }
              tabIndex={0}
              style={{
                minWidth: 0,
                letterSpacing: 0.05,
                // No text overflow styles: allow readable full label
                overflow: "visible",
                textOverflow: "unset",
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}