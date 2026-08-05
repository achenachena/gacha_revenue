import type { Metadata, Viewport } from "next";
import "./globals.css";

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "gacharevenue-gilt.vercel.app";
const metadataBase = new URL(productionHost.startsWith("http") ? productionHost : `https://${productionHost}`);

export const metadata: Metadata = {
  metadataBase,
  title: "二游流水观察｜Gacha Revenue Tracker",
  description: "A bilingual mobile revenue dashboard using public Sensor Tower aggregation and automated hourly Apple grossing-rank observations.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "二游流水观察｜Gacha Revenue Tracker",
    description: "六款二游的移动端公开源流水、上下半卡池、iOS 畅销榜与七条应用线逐小时观测。",
    type: "website",
    images: [{ url: "/og.png", width: 1729, height: 910, alt: "二游流水观察：公开移动端流水与 iOS 榜单观测" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "二游流水观察｜Gacha Revenue Tracker",
    description: "六款二游的移动端公开源流水、上下半卡池、iOS 榜单与七条应用线逐小时观测。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F5F1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
