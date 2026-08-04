import type { Metadata } from "next";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "Gacha Revenue Tracker | Mobile estimates & hourly ranks",
  description: "Compare public-source mobile revenue, exact banner phases, iOS grossing ranks, and automated China app-line observations.",
};

export default function EnglishDashboard() {
  return <Dashboard locale="en" />;
}
