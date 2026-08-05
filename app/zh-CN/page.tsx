import type { Metadata } from "next";
import Dashboard from "../dashboard";
import { loadInitialDashboardData } from "../server-data";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "二游流水观察｜移动端流水与小时榜单",
  description: "查看六款二游的公开源移动端流水、上下半卡池、iOS 畅销榜与中国区应用线逐小时观测。",
};

export default async function ChineseDashboard() {
  const initialData = await loadInitialDashboardData();
  return <Dashboard locale="zh-CN" initialRevenue={initialData.revenue} initialExchangeRate={initialData.exchangeRate} />;
}
