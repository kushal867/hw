/** @type {import('next').NextConfig} */

// Content-Security-Policy. Next.js needs inline bootstrap scripts/styles, so 'unsafe-inline' is allowed for those two only;
// everything else is locked to our own origin: no third-party scripts, no framing by other sites, no <base>/<object> tricks,
// forms and fetch/EventSource may only talk to ourselves.
// Google AdSense is allowed ONLY when NEXT_PUBLIC_ADSENSE_CLIENT is set at build time; otherwise the policy stays fully locked down.
const ads = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
const G = "https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.g.doubleclick.net https://partner.googleadservices.com https://tpc.googlesyndication.com https://www.googletagservices.com https://adservice.google.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${ads ? ` ${G}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${ads ? " https:" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${ads ? ` ${G} https://*.google.com` : ""}`,
  `frame-src 'self'${ads ? ` ${G}` : ""}`,
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pdf-lib", "pg"],
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },   // browsers ignore this over plain http
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
    ]}];
  },
};
export default nextConfig;
