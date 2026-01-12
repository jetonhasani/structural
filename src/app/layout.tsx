// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Structural Calculators",
  description: "Australian structural zone calculator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return (
    <html lang="en">
      <head>
        {/* ✅ Only load the Places library, not Maps */}
        <script
          async
          defer
          src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&region=AU`}
        ></script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}