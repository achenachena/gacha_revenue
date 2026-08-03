import type { Metadata } from "next";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "流水观察局｜二游流水估算与对比",
  description: "查看原神、崩铁、绝区零、鸣潮、终末地与异环的流水趋势、版本角色表现和 iOS 畅销榜数据。",
};

export default function ChineseDashboard() {
  return <Dashboard locale="zh-CN" />;
}

