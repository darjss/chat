export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Attempt to serve static assets from KV storage
    const cache = caches.default;
    let response = await cache.match(request);

    if (!response) {
      // If not in cache, fetch from the static asset bucket
      const pathname = url.pathname;
      let assetPath = pathname;

      // Clean up the pathname if needed
      if (pathname === "/" || pathname === "") {
        assetPath = "/index.html";
      }

      // Try to fetch the asset from the bucket
      try {
        response = await env.__STATIC_CONTENT.get(assetPath);
      } catch (e) {
        // Do nothing, we'll handle 404 below
      }

      // For client-side routing with React Router, return index.html for paths
      // that don't match static assets
      if (!response || response.status === 404) {
        // Try to return index.html for any non-asset route (SPA routing)
        try {
          response = await env.__STATIC_CONTENT.get("index.html");
        } catch (e) {
          return new Response("Not Found", { status: 404 });
        }
      }

      // Cache the response
      if (response.status === 200) {
        ctx.waitUntil(cache.put(request, response.clone()));
      }
    }

    return response;
  },
};
