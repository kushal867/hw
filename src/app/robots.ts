import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";

// Public pages are open to crawlers; everything private (accounts, groups, chat, APIs) is excluded.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/moderator", "/dashboard", "/groups/", "/chat", "/my-groups", "/profile", "/settings", "/notifications",
        "/pdf-maker", "/saved", "/join/", "/auth/", "/report-content", "/login", "/signup", "/forgot-password", "/reset-password", "/media/avatars/", "/search?"],
    }],
    sitemap: abs("/sitemap.xml"),
  };
}
