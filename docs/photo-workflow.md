# Photo uploads and delivery
Updated 2026-11-09.

The owner prioritised fixing photo uploads and slow image loading before the separate Admin/client interface project.

## Uploads
Services and Business Profile share photo-tools.js. Choose portrait, landscape or square images up to 25 MB. Browser decoding determines phone-format support; unreadable HEIC/HEIF files get an explicit message requesting a compatible version. JPG, PNG, WebP and AVIF are accepted.

The browser draws the complete decoded photo at its original proportions, never enlarges it, and limits the longest edge to 1920px (768px for logos). It encodes WebP where supported and accepts the canvas PNG fallback, targeting at most 1 MB with bounded quality/size retries. The existing upload endpoint and 5 MB bucket limit remain the final guard. No original-size upload or manual crop is required. New uploads save the prepared image; existing stored originals are untouched.

Preparation locks Save and image selection. Services also blocks closing/Escape until preparation ends. Failed replacements preserve the previous photo and service/profile draft. Existing upload UUIDs, save retry behaviour, ownership and concurrency checks remain.

## Delivery
Supabase's current free plan has no native image transformations. Vercel's existing image optimizer serves allowed Supabase service-photos paths and three local PNG assets at 96/192/384/640/960/1600 widths, quality 75, WebP where supported. Remote allowlisting is restricted to this project's public photo bucket; no service-role key or new dependency is involved. Unknown external logo URLs remain direct.

Client service cards and the hero use responsive sources. Small previews/thumbnails request small copies. Image boxes retain space; images reveal after decode and fall back to the original URL if optimization fails. Service images and the hero contain the whole photo, and logos retain their edges. Cache lifetime is bounded to one hour for compatibility with the existing upload retry upsert.

## Verification
Native photo preparation tests use mocked browser image/canvas APIs; they verify dimensions/proportions, no crop/enlargement, compression retries, format fallback, errors and object-URL cleanup. They do not prove actual browser codec/orientation support.
Services tests include preparation/save locking and failed replacement retention, along with existing record/pricing/publication/retry/concurrency checks. Admin navigation and availability sync checks remain in place.

This Windows session cannot launch Chromium due to OS access restrictions. Real browser selection/encoding/EXIF orientation, actual multipart Supabase upload, and physical Safari/iOS remain unverified in this session. Preview/production endpoint checks are recorded in PROJECT_HANDOFF.md after deployment.

No business records, storage originals, booking/payment rules, database schema or bucket policies are changed. Interface redesign follows as a separate agreed project.
