import { createBrowserRouter } from "react-router-dom";
import Layout from "./layout";
import DashboardPage from "../pages/DashboardPage";
import SellMedicinePage from "../pages/SellMedicinePage";
import AddStockPage from "../pages/AddStockPage";
import MedicinesPage from "../pages/MedicinesPage";
import AlertsPage from "../pages/AlertsPage";
import HistoryPage from "../pages/HistoryPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "sell", element: <SellMedicinePage /> },
      { path: "stock", element: <AddStockPage /> },
      { path: "medicines", element: <MedicinesPage /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "history", element: <HistoryPage /> },
    ],
  },
]);