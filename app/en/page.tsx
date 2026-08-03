import type { Metadata } from "next";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "Gacha Revenue Observatory | Estimates & Comparisons",
  description: "Compare gacha game revenue trends, versions, banners, and iOS grossing performance on one consistent methodology.",
};

export default function EnglishDashboard() {
  return <Dashboard locale="en" />;
}

