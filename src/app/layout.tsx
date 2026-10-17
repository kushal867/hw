import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "EduSathi — Your Semester. Your Notes. Your Community.", template: "%s · EduSathi" },
  description: "Share study materials, discover important exam questions, and learn together with classmates — free for students in Nepal.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${devanagari.className}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:p-3">Skip to content</a>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
