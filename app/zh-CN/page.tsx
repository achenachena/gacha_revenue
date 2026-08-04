import type { Metadata } from "next";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "二游流水观察｜移动端流水与小时榜单",
  description: "查看六款二游的公开源移动端流水、上下半卡池、iOS 畅销榜与中国区应用线逐小时观测。",
};

export default function ChineseDashboard() {
  return <Dashboard locale="zh-CN" />;
}
