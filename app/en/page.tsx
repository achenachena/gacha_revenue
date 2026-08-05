import type { Metadata } from "next";
import Dashboard from "../dashboard";
import { loadInitialDashboardData } from "../server-data";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Gacha Revenue Tracker | Mobile estimates & hourly ranks",
  description: "Compare public-source mobile revenue, exact banner phases, iOS grossing ranks, and automated China app-line observations.",
};

export default async function EnglishDashboard() {
  const initialData = await loadInitialDashboardData();
  return <Dashboard locale="en" initialRevenue={initialData.revenue} initialExchangeRate={initialData.exchangeRate} />;
}
