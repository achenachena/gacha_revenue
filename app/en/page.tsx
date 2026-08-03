import type { Metadata } from "next";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "Gacha Revenue Tracker | Estimates & Comparisons",
  description: "Compare modelled gacha revenue, character banners, iOS grossing ranks, and verified China app-line observations.",
};

export default function EnglishDashboard() {
  return <Dashboard locale="en" />;
}
