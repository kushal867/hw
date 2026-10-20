import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { env } from "@/lib/env";
import { DEFAULT_DESCRIPTION, SITE_NAME, ogImage } from "@/lib/seo";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "EduSathi: Your Semester. Your Notes. Your Community.", template: "%s · EduSathi" },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["study groups Nepal", "college notes Nepal", "BIT notes", "BIM notes", "BCA notes", "BBS notes", "TU notes", "exam preparation", "past question papers"],
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_NP", title: "EduSathi: Your Semester. Your Notes. Your Community.", description: DEFAULT_DESCRIPTION, images: [{ url: ogImage("Your Semester. Your Notes. Your Community."), width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "EduSathi", description: DEFAULT_DESCRIPTION, images: [ogImage("Your Semester. Your Notes. Your Community.")] },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
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
