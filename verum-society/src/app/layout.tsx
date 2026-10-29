import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Shell } from "@/components/Shell";
import "./globals.css";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Verum Society",
  description: "Private members club. Alleen op uitnodiging.",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0a0709" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
