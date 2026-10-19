import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Outfit } from "next/font/google";
import { Footer } from "@/components/Footer";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: "HOD Industry Visit | MCCIA",
  description: "Report an industry visit with photo proof, location and time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#176dae",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${bricolage.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
