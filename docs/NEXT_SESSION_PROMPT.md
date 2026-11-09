Continue LogTraq in Naeiseul/Booking from current main. Read AGENTS.md, newest docs/PROJECT_HANDOFF.md section and docs/photo-workflow.md first.

Owner priority: finish photo upload/proportion/loading fixes, then improve BOTH Admin and client interfaces in small agreed steps. Do not automatically move to scheduling.

Photo preparation and sized Vercel delivery are implemented. Read release notes for actual endpoint checks and outstanding browser limitations. Verify real phone/desktop file selection, EXIF orientation, encoding and multipart Supabase upload using isolated QA before claiming the whole photo flow verified. HEIC support depends on browser decoding.

Preserve existing photos/records/pricing, Services groups and Business Profile. Keep shared classes unbookable until scheduling/capacity works, service payments disabled, real Paystack intact, date/time-only slots accepted and Order summary paused. Specific service sessions at exact dates/times remain a future requirement; scheduling/capacity → reservations → verified payments remains the later sequence.
