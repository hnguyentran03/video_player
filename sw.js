// Network bandwidth emulation for ABR testing.
//
// dash.js fetches media segments via XHR, so throttling has to happen below the
// page. This service worker intercepts segment requests and meters the response
// body out at a capped byte rate. Because the bytes genuinely arrive slowly,
// dash.js's ThroughputController measures the emulated bandwidth and the ABR
// rules react to it for real (not a faked delay).
//
// The page controls the cap via postMessage({ type: 'setCap', bytesPerSec }).

let capBytesPerSec = Infinity; // Infinity = unthrottled

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'setCap') {
        capBytesPerSec = event.data.bytesPerSec == null ? Infinity : event.data.bytesPerSec;
    }
});

// Only meter actual media segments (leave the manifest and app assets alone).
const MEDIA_RE = /\.(m4v|m4a|m4s|mp4|cmfv|cmfa|ts)(\?|$)/i;

self.addEventListener('fetch', (event) => {
    if (capBytesPerSec === Infinity) return;        // unthrottled: let the browser handle it
    if (!MEDIA_RE.test(event.request.url)) return;  // not a media segment
    event.respondWith(throttledFetch(event.request));
});

async function throttledFetch(request) {
    const response = await fetch(request);
    if (!response.body) return response; // opaque/no-body response, can't stream
    return new Response(makeThrottledStream(response.body), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    });
}

// Wraps a response body stream in a token-bucket rate limiter. The cap is read
// live on each iteration, so changing speed mid-download takes effect immediately.
function makeThrottledStream(body) {
    const reader = body.getReader();
    let allowance = 0;                  // bytes currently permitted to send
    let last = performance.now();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    return new ReadableStream({
        async pull(controller) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); return; }

            let offset = 0;
            while (offset < value.length) {
                const rate = capBytesPerSec;
                if (rate === Infinity) {            // switched to unlimited mid-stream
                    controller.enqueue(value.subarray(offset));
                    break;
                }
                const now = performance.now();
                allowance += ((now - last) / 1000) * rate;
                last = now;
                if (allowance > rate) allowance = rate; // cap burst to ~1s worth

                if (allowance < 1) { await sleep(20); continue; }

                const take = Math.min(value.length - offset, Math.floor(allowance));
                controller.enqueue(value.subarray(offset, offset + take));
                offset += take;
                allowance -= take;
            }
        },
        cancel(reason) { reader.cancel(reason); }
    });
}
