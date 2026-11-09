import { handle } from './core.mjs';
import { invoicePdf } from './pdf.ts';
Deno.serve(request => handle(request,{pdf:invoicePdf,defer:task=>EdgeRuntime.waitUntil(task)}));
