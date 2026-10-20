// Google asks AdSense publishers to serve /ads.txt. It only exists once ADSENSE_PUBLISHER_ID (e.g. "pub-1234567890123456") is configured.
export async function GET() {
  const id = process.env.ADSENSE_PUBLISHER_ID;
  if (!id || !/^pub-\d{10,20}$/.test(id)) return new Response("Not found", { status: 404 });
  return new Response(`google.com, ${id}, DIRECT, f08c47fec0942fa0\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
