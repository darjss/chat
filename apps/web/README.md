# React Router App on Cloudflare Workers

This application is configured to deploy a React Router client-side rendered app to Cloudflare Workers.

## Development

To run the app locally:

```bash
npm run dev
```

## Deployment

The app is set up to be deployed to Cloudflare Workers using Wrangler. To deploy:

1. Build the app:

   ```bash
   npm run build
   ```

2. Deploy to Cloudflare Workers:
   ```bash
   npm run deploy
   ```

## Configuration

The deployment is configured in `wrangler.jsonc`:

- The site's static assets are served from the `build/client` directory
- A worker script (`src/worker.js`) handles routing for client-side navigation
- The worker serves the `index.html` file for routes that don't match static assets

## How it Works

The setup uses Cloudflare Workers to serve the React Router application:

1. Static assets (JS, CSS, images) are served directly from the asset bucket
2. All other routes are served the `index.html` file to allow React Router to handle client-side routing
3. Response caching is implemented to improve performance
