import type { Metadata } from "next";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "二游流水观察｜流水估算与对比",
  description: "查看六款二游的已核验流水、具体卡池角色、iOS 畅销榜与中国区应用线排名。",
};

export default function ChineseDashboard() {
  return <Dashboard locale="zh-CN" />;
}
