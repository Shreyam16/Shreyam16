# ISHÉ Private Showroom

An appointment-only jewellery showroom on the web. Visitors start on the street outside a
black-framed glass double door under the white ISHÉ sign, scroll to open the doors and walk in,
then explore a U-shaped showroom (15 m × 14 m, 3.8 m ceiling) in real-time 3D.

- **Left:** Necklaces & Bracelets
- **Straight:** Rings & Combos (with the cashier counter)
- **Right:** Earrings & Pendants

## Run it

```bash
cd ishe-showroom
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit tests (catalogue, floor plan & collision, Shopify checkout) |
| `npm run e2e` | Browser checks against a running server (`BASE_URL`, `CHROMIUM_PATH`) |
| `npm run assets` | Rebuild the logo files from `brand-source/` |
| `node scripts/render-product-images.mjs` | Re-render the 24 sample product images (dev server running) |
| `node scripts/render-lite-backdrops.mjs` | Re-capture the lite-mode stills (dev server running) |

URL options: `?mode=3d` forces the 3D showroom, `?mode=lite` forces the lite showroom.

## Where things live

| Path | Contents |
| --- | --- |
| `src/data/catalogue.ts` | **Single source of truth** for the 24 products, sample prices/copy, pairings, combos |
| `src/data/shopify-variants.ts` | SKU → Shopify ProductVariant GID mapping (kept apart from data and scene) |
| `src/lib/shopify.ts`, `src/app/api/checkout/route.ts` | Server-side Shopify cart creation |
| `src/scene/layout.ts` | Floor plan, display placement, colliders, navigation graph, camera poses (pure TS, unit-tested) |
| `src/scene/*.tsx` | Three.js / React Three Fiber scene: architecture, vitrines, jewellery, camera rig |
| `src/components/*` | Interface: wayfinding, product panel, Jewel Box, finder, cashier, lite showroom |
| `public/brand/` | Logo files generated from the supplied brand board |

## Brand

`brand-source/ishe-brand-board.webp` is the supplied ISHÉ board. `scripts/build-logo.mjs` crops the
main wordmark from it without redrawing any letters and writes:

- `public/brand/ishe-logo-plaque.png`: black wordmark on a white rectangular plaque (storefront sign, header)
- `public/brand/ishe-wordmark-black.png`: black wordmark on transparent (wall behind the cashier)

UI type is Bodoni Moda, Cormorant Garamond and Jost, self-hosted through `@fontsource`.

## Demo data (please read)

- Product **names and SKUs** are exactly the 24 supplied. Nothing else was added.
- **Prices, descriptions, occasions and pairings are sample demo data**, marked as such in
  `catalogue.ts` and labelled "Sample" in the interface. Replace before launch.
- **Product images are sample renders** of stylised procedural 3D jewellery
  (`public/products/*.webp`, each stamped "SAMPLE RENDER", `image.isSample: true`). They are not
  photographs of ISHÉ pieces. To use real photography, drop files into `public/products/` and
  update `image` in the catalogue.
- No metal purity, stone authenticity, warranty or other specification is claimed anywhere.
- Combos are pairings of existing SKUs only.

## Shopify checkout

Checkout uses Shopify's supported Storefront API cart flow: the server calls `cartCreate` with
the mapped variant IDs and the browser is redirected to the `checkoutUrl` Shopify returns.
Without full configuration, checkout stays in clearly labelled **demo mode**: no order, no
payment, no stock reservation, and the UI says so.

**Status in this repository: not connected.** No store domain, token or variant IDs are configured.

### Setup

1. In Shopify admin, install the **Headless** sales channel (or create a custom app with
   Storefront API access) and create a **private Storefront API access token**. Its storefront
   permissions must allow reading product listings and writing carts / checkouts
   (`unauthenticated_read_product_listings`, `unauthenticated_write_checkouts`).
2. Create the 24 products in Shopify and publish them to that channel.
3. Put each variant's GID (`gid://shopify/ProductVariant/…`) into
   `src/data/shopify-variants.ts`, or supply them as JSON in `SHOPIFY_VARIANT_MAP`.
4. Set environment variables (locally in `.env.local`, on Vercel in Project → Settings →
   Environment Variables). They are server-only; do not prefix them with `NEXT_PUBLIC_`:

| Variable | Example | Notes |
| --- | --- | --- |
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com` | Required |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | *(secret)* | Required. Sent only from the server as `Shopify-Storefront-Private-Token` |
| `SHOPIFY_STOREFRONT_API_VERSION` | `2025-10` | Optional. Use a currently supported Storefront API version |
| `SHOPIFY_VARIANT_MAP` | `{"ISH-N01":"gid://shopify/ProductVariant/123"}` | Optional override of `shopify-variants.ts` |

`GET /api/checkout` reports `{ configured, mappedVariants, totalProducts }` (no secrets), which
the cashier uses to decide whether to show the demo banner. If any SKU in an order is unmapped,
that order stays in demo mode and says which SKU is missing.

## Deploying to Vercel

The app lives in the `ishe-showroom/` folder of this repository. In Vercel, import the repo and set
**Root Directory** to `ishe-showroom`. Everything is statically rendered except `/api/checkout`,
which runs as a serverless function because the Storefront token must stay on the server.

## Experience notes

- **Entrance first.** Every visit starts outside. Scrolling (GSAP ScrollTrigger + Lenis) approaches
  the store, swings the doors open and carries the camera through them. "Walk me in" plays the same
  walk automatically.
- **Wayfinding.** At the junction the visitor chooses Left / Straight / Right. After that a room bar,
  a small plan and a "Displays here" list reach any room or vitrine. Routes follow a navigation graph
  so the camera never passes through walls or cases.
- **Moving freely.** Desktop: WASD / arrow keys, Q/E to turn, drag to look. Phones: a hold-to-walk
  pad. Collision keeps the visitor out of walls, furniture and vitrines; the camera stays at 1.65 m
  (it leans down to about 1.5 m over low table vitrines).
- **Products.** Selecting a vitrine walks up to it, narrows the field of view and opens the panel
  (image, name, SKU, sample price, sample description, pairings, Add to Jewel Box, Buy Now, Save).
  Back / Esc returns to the exact prior camera position.
- **Cashier.** Buy Now (or "Take to the cashier" in the Jewel Box) walks the camera to the cashier
  counter, places the piece on the counter tray and shows the order summary before Shopify.
- **Sound.** Off by default. A synthesised ambience (Web Audio, no files) plays only after the
  visitor turns it on.
- **Reduced motion.** Honoured throughout: no smooth scrolling, instant camera moves, no zoom easing.

### Performance and fallback

- Lighting uses one hemisphere light, one directional light and image-based lighting from a
  procedural studio environment. Display glow, wall washes and contact shadows are baked decals,
  not extra lights. No shadow maps.
- Static geometry is merged by material at load: about 110 draw calls inside and 190 outside.
- DPR is capped at 1.75.
- The lite showroom is used when WebGL is missing, when the GPU is a software renderer, on
  devices reporting under 2 GB memory or 2 cores, or if the WebGL context is lost. It keeps the
  scroll entrance (stills captured from the 3D scene), room navigation, vitrine browsing, the product
  panel, Jewel Box and cashier. If the 3D view runs below about 18 fps, the visitor is offered the
  lite showroom.

## Assets still needed

| Asset | Why |
| --- | --- |
| Product photography for all 24 SKUs | Replace the sample renders in `public/products/` |
| Approved prices and copy | Replace sample values in `catalogue.ts` |
| Shopify store, token and 24 variant IDs | Turn on real checkout |
| (Optional) Licensed, optimised GLB jewellery models | Replace the procedural stylised pieces |
| (Optional) Licensed realistic human figures (GLB, rigged) | Staff or visitors. None were available, so the showroom has no people rather than low-quality avatars |
| (Optional) Vector (SVG) master of the wordmark | The plaque is cut from the supplied raster board, which is sharp at current sizes but not infinitely scalable |

No third-party 3D models, HDRIs or images are used. All geometry is procedural and all textures
are generated in code or rendered from the scene.

## Known limitations

- The jewellery is stylised procedural 3D, not scans of the real pieces.
- Real checkout has only been tested against a mocked Shopify response (unit test). It has not run
  against a live store.
- Automated browser tests run on software WebGL (SwiftShader) at low frame rates. Motion quality
  and frame rate on real phones should be checked by hand.
- The Jewel Box and saved list are stored in the browser (localStorage), per device.
