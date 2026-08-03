import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: origin,
    title: "二游流水观察｜Gacha Revenue Tracker",
    description: "A bilingual gacha revenue dashboard with modelled revenue estimates and verified iOS rank observations.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "二游流水观察｜Gacha Revenue Tracker",
      description: "六款二游的模型流水估算、具体卡池角色、iOS 畅销榜与核验应用线数据。",
      type: "website",
      images: [{ url: socialImage, width: 1672, height: 941, alt: "二游流水观察数据仪表盘" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "二游流水观察｜Gacha Revenue Tracker",
      description: "六款二游的模型流水估算、具体卡池角色、iOS 畅销榜与核验应用线数据。",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F5F1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
