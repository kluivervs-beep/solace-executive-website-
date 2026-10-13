// Blocks other websites from loading our photos and videos straight from our server.
// Requests with no referer (typing the address, share previews, search engines, the app) pass.
const OWN = ['solaceexecutive.com', 'www.solaceexecutive.com'];
export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const ref = request.headers.get('referer');
  if (ref) {
    let host = '';
    try { host = new URL(ref).hostname.toLowerCase(); } catch (_) { host = ''; }
    const ok = OWN.includes(host) || host.endsWith('.netlify.app') || host === 'localhost' || host === '127.0.0.1';
    if (host && !ok) return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return context.next();
};
