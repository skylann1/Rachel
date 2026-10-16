import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RACHEL K3",
  description: "Sistem manajemen keselamatan dan izin kerja K3",
  applicationName: "RACHEL K3",
  // app/manifest.ts is linked automatically; these cover the iOS/mobile shell.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RACHEL K3",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#00b0f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <InstallAppButton />
      </body>
    </html>
  );
}
