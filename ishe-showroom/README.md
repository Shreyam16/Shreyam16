# ISHÉ Private Showroom

An appointment-only jewellery showroom on the web. Visitors start on the street outside a
black-framed glass double door under the ISHÉ sign, scroll to open the doors and walk in, then
explore one long, open gallery (15 m × 14 m, 3.8 m ceiling) in real-time 3D: a central aisle lined
with low glass-topped cases between two rows of white columns, a side gallery beyond each colonnade,
and one hero necklace on a lit pedestal in front of a black feature wall at the far end.

- **Left** (left side gallery and aisle cases): Necklaces & Bracelets
- **Straight** (far end): Rings & Combos, the hero pedestal, and the cashier counter in the back-right corner
- **Right** (right side gallery and aisle cases): Earrings & Pendants

Look: a warm, gallery-like boutique. Outside, a cream limestone facade with rusticated joints, a
black-framed shopfront, tall linear sconces, square black planters with boxwood, and the ISHÉ
wordmark in white on a black lacquered fascia. Inside, warm white limewash walls with pilasters and
brass linear sconces, a polished white terrazzo floor with brass inlays at each threshold, black
lacquered vitrines with glass tops and champagne suede decks, linear light slots along the aisle
ceiling, and gold-leaf art. The far end's feature wall is black lacquer with thin warm light slits
and the wordmark in white, under a lowered white tray, with a statement chandelier over the combos
table. A small lounge (two armchairs, side table with a tea tray, rug) sits at the back of the left
gallery; there are four staff. The showroom opens at dusk, lit from within; the sun icon switches
to daylight.

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
| `python3 bake/bake.py` (bpy 4.2, Python 3.11) | Re-bake lighting; see "Light bake" below |

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
| `src/scene/features.ts` | Decor, furniture, staff spots, salon tray, thresholds (pure data, shared with the bake) |
| `src/scene/Staff.tsx` | The four staff: rigged GLBs, idle loop, head turn, click to talk |
| `src/scene/Evening.tsx` | Day / evening lighting balance |
| `src/components/StaffPanel.tsx`, `TourBar.tsx` | Staff greeting and guided tours |
| `src/components/AppointmentDrawer.tsx`, `src/app/api/appointment/route.ts` | Private appointment requests |
| `src/components/TryOnDialog.tsx` | Camera try-on (MediaPipe Face Landmarker, on-device) |
| `src/lib/share.ts`, `src/components/SharedPanel.tsx` | Jewel Box share links |
| `src/app/ring-size-guide/` | Printable ring-size guide (approximate) |
| `public/staff/` | Staff models (compressed GLB) |
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

Cashier extras (gift wrapping, gift note, engraving request) are sent with `cartCreate` as cart
`attributes` ("Gift wrap", "Engraving request (to be confirmed by the store)") and the cart `note`,
only when Shopify is configured. In demo mode they are listed in the demo summary instead.
Engraving is always labelled a request confirmed by the store.

`GET /api/checkout` reports `{ configured, mappedVariants, totalProducts }` (no secrets), which
the cashier uses to decide whether to show the demo banner. If any SKU in an order is unmapped,
that order stays in demo mode and says which SKU is missing.

## Appointments and WhatsApp

The appointment form (calendar icon, or from any member of staff) collects date, time slot, pieces
of interest (from the Jewel Box and saved pieces), name, phone, email and notes. `POST
/api/appointment` validates it on the server and then:

- emails the store through Resend when `RESEND_API_KEY` and `APPOINTMENT_EMAIL_TO` are set, or
- posts the request as JSON to `APPOINTMENT_WEBHOOK_URL` (a spreadsheet, CRM or automation), or
- otherwise does nothing and says so: **demo mode, not sent, not booked**.

Even when a request is delivered, the visitor is told the store will contact them to confirm; the
site never claims a booking is confirmed. `GET /api/appointment` reports `{ configured }`.

The WhatsApp concierge button opens `https://wa.me/<number>?text=…` with the visitor's details
prefilled; nothing is sent until they press send in WhatsApp. Without
`NEXT_PUBLIC_WHATSAPP_NUMBER` it shows "not configured".

The Jewel Box has two more WhatsApp buttons: **Send to a friend** (`https://wa.me/?text=…`, WhatsApp
asks which contact) and **Ask the store about these** (to the store's number, so staff can follow up
with a curated reply). Both carry piece names, SKUs and the share link only. Each product panel also
has "Ask about this piece on WhatsApp" when the number is set.

## Visit statistics

`src/lib/analytics.ts` records which rooms and pieces were viewed and for how long (`room_dwell`,
`piece_dwell`), plus try-on, tour, Jewel Box, appointment and checkout events. It is first-party and
cookie-free: a random per-tab id, SKUs, room names and counts, never names, contact details, notes
or IP addresses. Browsers with Do Not Track or Global Privacy Control send nothing. Batches go to
`POST /api/analytics` every 15 s (and on leaving the page), where the server re-validates them
(`cleanBatch`) and forwards them to `ANALYTICS_WEBHOOK_URL` if set; otherwise they are discarded
(`{ stored: false }`). Point the webhook at a sheet, a warehouse or an automation.

| Variable | Scope | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | server | Resend API key |
| `APPOINTMENT_EMAIL_TO` | server | Store inbox(es), comma-separated |
| `APPOINTMENT_EMAIL_FROM` | server | Optional verified sender; defaults to Resend's test sender |
| `APPOINTMENT_WEBHOOK_URL` | server | Optional alternative to email (https only) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | public | International format, e.g. `+91 98765 43210` |
| `ANALYTICS_WEBHOOK_URL` | server | Optional; receives anonymous visit statistics as JSON |

## Deploying to Vercel

The app lives in the `ishe-showroom/` folder of this repository. In Vercel, import the repo and set
**Root Directory** to `ishe-showroom`. Everything is statically rendered except `/api/checkout`,
and `/api/appointment`, which run as serverless functions because their tokens must stay on the server.

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
  counter, places the piece on the counter tray and shows the order summary, with gift wrapping, a
  gift note, an engraving request and the ring-size guide.
  - **With Shopify connected:** "Pay securely with Shopify" hands off to Shopify's checkout, which
    takes the payment and emails the real receipt and order confirmation.
  - **Without Shopify (demo):** "Pay at the counter (demo)" plays the in-store ceremony: the card
    terminal lights up (no card is read, no money moves), the piece is boxed and gift-wrapped if
    asked, slid across the counter, and a receipt slip is printed. The on-screen receipt is marked
    SAMPLE throughout ("No payment was taken… not a tax invoice") and can be printed as such.
- **Loading.** A branded screen (the ISHÉ plaque and a thin line driven by real texture and model
  loading) fades into the street once the first frame is drawn. Staff stream in afterwards so they
  never hold the entrance back.
- **Staff.** A cashier and a consultant behind the counter, an attendant by the lounge at the back
  of the left gallery, and one greeting visitors at the front of the right gallery. Each
  holds a calm standing pose with a slowed, low-weight idle layered on top (breathing, a little
  weight shift); the clip's root turn and drift are cancelled so they stay on their spot. They glance
  at a nearby visitor now and then rather than staring, and keep polite eye contact only while the
  visitor is talking to them (or is at the counter, for the cashier and consultant). Selecting one, or "Ask the attendant" in the room bar, walks the camera
  to a polite distance and opens a greeting with guided tours. The cashier greets the visitor in
  the order summary. Staff are not shown in the lite showroom; there the same tours sit behind
  "Guided tour".
- **Guided tours.** Bridal, Everyday, Gifting and Festive visit every piece tagged with that
  (sample) occasion in walking order; "Show me around" walks every room. Previous / Next / Stop;
  Stop returns the visitor to where the tour began. Fully keyboard operable; instant under reduced
  motion.
- **Camera try-on** for every piece. Earrings, necklaces and pendants use MediaPipe Face
  Landmarker; rings and bracelets use Hand Landmarker (the ring sits on the ring finger between the
  knuckle and the middle joint, the bracelet just below the wrist, both turned with the hand; phones
  prefer the rear camera for hands). The camera is requested only when the visitor taps "Start
  camera". The model (tasks-vision 1.0.1 from jsDelivr, model files from Google's MediaPipe storage)
  loads only after permission is granted and runs on the device; no image is uploaded or stored. The
  procedural 3D piece is drawn over the video (mirrored for a front camera), labelled "Preview, not
  exact scale". Refused permission, no camera or no WebGL each get a plain fallback.
- **Share your Jewel Box.** The link carries SKUs and quantities only (`?box=ISH-N01*2,ISH-E02`),
  validated against the catalogue. Opening it still starts outside; the "Shared selection" panel
  appears once inside, and nothing is added until the visitor chooses.
- **Dusk by default** (sun/moon icon switches to daylight and back): dusk sky, lit facade sconces, a
  warm glow in the shop windows and neighbouring flats, slightly lower light inside. Instant under reduced motion. The
  lite showroom uses a dusk tint over its daylight stills.
- **Sound.** Off by default. A synthesised ambience (Web Audio, no files) plays only after the
  visitor turns it on. With sound on, staff also speak: a greeting from each attendant, the
  consultant and the cashier, a line introducing each tour, and a line at each step of the counter
  ceremony (17 short clips in `public/voice/`, about 190 KB each, fetched only when played). Nothing
  is spoken while sound is off.
- **Seasonal windows.** The two shop windows beside the door dress themselves for the season:
  festive (Navratri to Diwali, marigold garlands and diyas), wedding season (late November to
  February, jasmine strings) or classic. Each window shows an existing catalogue piece on a
  plinth. `?season=festive|wedding|classic` previews another season.
- **Reduced motion.** Honoured throughout: no smooth scrolling, instant camera moves, no zoom easing.

### Performance and fallback

- Lighting uses one hemisphere light, one directional light and image-based lighting from a
  procedural studio environment. Display glow, wall washes and contact shadows are baked decals,
  not extra lights. No shadow maps.
- Static geometry (including all new furniture, mouldings, curtains, mirrors and the chandelier)
  is merged by material at load. Measured draw calls per frame (whole frame, e2e on the gallery
  plan, before the floor reflection): street 257, junction 149, left gallery 112, far end 84,
  right gallery 125, cashier 51–56.
- "High" tier (desktops): a soft planar reflection in the terrazzo (one extra low-resolution scene
  pass, about a third of the canvas size, so draw calls roughly double), ambient occlusion, glow
  on the lights (strong at dusk, nearly off in daylight), a light contrast/saturation grade, SMAA
  and a vignette; DPR up to 2. Phones and small or low-memory devices ("standard") get none of these.
- Try-on mirrors reflect the environment map (metal, low roughness): no render targets.
- Staff: 4 skinned meshes, one material each, 1024 px WebP textures, 1.8–2.2 MB per GLB.
- DPR is capped at 1.75 on the standard tier.
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
| (Optional) Vector (SVG) master of the wordmark | The plaque is cut from the supplied raster board, which is sharp at current sizes but not infinitely scalable |

### Asset credits

- **Staff voices** (`public/voice/*.wav`): generated for this project with Higgsfield text-to-speech
  (Seed Audio; stock voices Maya, Julian and Gia), down-mixed to mono. Not recordings of ISHÉ staff.
- **Staff figures** (`public/staff/*.glb`): generated for this project with Higgsfield. A
  photoreal full-body reference image of each person (GPT Image 2.5) was converted with Meshy 7
  image-to-3D (ultra detail), auto-rigged with the Idle_02 clip. Re-packed for the web with
  `scripts/repack-staff.cjs` (textures to 1024 px WebP via `EXT_texture_webp`, duplicated emissive
  and exaggerated specular removed) and `scripts/quantize-staff.py` (`KHR_mesh_quantization`:
  normals int8, UVs uint16, skin weights uint8): 2.0–2.8 MB each. They are illustrative figures,
  not portraits of ISHÉ staff or of real people.
- Everything else is procedural: geometry built in code, textures generated in code or rendered
  from the scene. No third-party HDRIs or images.

## Light bake

`bake/bake.py` rebuilds the room from `bake/layout.json` (exported from the TypeScript floor plan by
`npx vitest run --config bake/vitest.config.ts`) and bakes direct + indirect diffuse lighting with
Blender Cycles. Occluders carry their real albedo (white limewash, terrazzo, black lacquer, walnut,
bronze, champagne suede, bouclé), so the bounce light matches the finishes; the maps themselves hold
lighting only. Display
spots are tight (22°) accents; the salon has lower, warmer (2700–2800 K) light from under the tray,
its cove and the chandelier. Then:

```bash
node bake/to-png.mjs && mv public/bake/*.webp public/bake/exposure.npy bake/raw/
node bake/postprocess.mjs   # partial white balance (35% of the warmth kept), denoise, ceiling lift
```

### CI workflow

`.github/workflows/ishe-assets.yml` runs on pushes to `claude/**` branches whose commit message
contains a tag: `[ishe-assets]` (lint, typecheck, unit tests, bake, lite stills, e2e; commits the
bake and stills back), `[ishe-assets:stills]` or `[ishe-assets:qa]`. Add `samples=256` to the
message to change bake quality. e2e screenshots (as JPEG) and `results.json` are force-pushed to
the `qa-screenshots` branch for review.

## Known limitations

- The jewellery is stylised procedural 3D, not scans of the real pieces.
- Real checkout has only been tested against a mocked Shopify response (unit test). It has not run
  against a live store.
- Automated browser tests run on software WebGL (SwiftShader) at low frame rates. Motion quality
  and frame rate on real phones should be checked by hand.
- The Jewel Box and saved list are stored in the browser (localStorage), per device.
- Staff positions are quantized but not meshopt/Draco-compressed (no encoder was reachable from
  the build environment).
- Staff are AI-generated: faces are natural at conversational distance but slightly faceted at
  very close range (the camera never frames a face closely), and they have no facial animation
  (no blinking or speech). Photoreal staff would need licensed scanned or Character Creator
  figures with motion-capture idles.
- Try-on placement is approximate (landmarks plus an assumed face width or knuckle span), not a
  fit tool. Fingers do not hide the back of a ring or bracelet.
  It needs camera permission, WebGL and a connection for the first model download. It has been
  tested for the refused-permission path in automated tests; live camera tracking has to be
  checked by hand on real devices.
- Appointment email / webhook delivery is tested against mocked responses only.
- Spoken lines are fixed recordings: the staff do not answer questions, and their lips do not move.
- Visit statistics are only collected; there is no dashboard in the app. Use the webhook target's.
- Evening mode in the lite showroom is a tint over daylight stills.
