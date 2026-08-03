import type { Metadata } from "next";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "Gacha Revenue Tracker | Estimates & Comparisons",
  description: "Compare sourced gacha revenue, character banners, iOS grossing ranks, and China app-line performance.",
};

export default function EnglishDashboard() {
  return <Dashboard locale="en" />;
}
