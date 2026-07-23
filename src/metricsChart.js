// Live strip chart of ABR-relevant metrics.
//
// Samples every 500 ms into a 60 s ring buffer: measured throughput, emulated
// cap, and playing bitrate (kbps, left axis) plus buffer level (seconds, right
// axis). Reads the page-global `player` binding live on each tick, so it keeps
// working across the player teardown/reinit that rule switches trigger — the
// timeline stays continuous on purpose.

const CHART_SAMPLE_MS = 500;
const CHART_MAX_SAMPLES = 120; // 60 s window

// Validated categorical palette (slots 1-4) + chart chrome inks.
const CHART_COLORS = {
    thr:   '#2a78d6',
    cap:   '#eb6834',
    play:  '#1baf7a',
    buf:   '#eda100',
    grid:  '#e1e0d9',
    axis:  '#c3c2b7',
    label: '#898781',
    ink:   '#0b0b0b',
};

const CHART_SERIES = [
    { key: 'thr',  label: 'Throughput',           fmt: (v) => `${Math.round(v)} kbps` },
    { key: 'cap',  label: 'Cap',                  fmt: (v) => `${Math.round(v)} kbps` },
    { key: 'play', label: 'Playing bitrate',      fmt: (v) => `${Math.round(v)} kbps` },
    { key: 'buf',  label: 'Buffer (right axis)',  fmt: (v) => `${v.toFixed(1)} s` },
];

const chartSamples = []; // ring buffer of { thr, cap, play, buf }, null = no data

function sampleMetrics() {
    const s = { thr: null, cap: null, play: null, buf: null };
    try {
        if (typeof player !== 'undefined' && player) {
            const buf = player.getBufferLength('video');
            if (Number.isFinite(buf)) s.buf = buf;
            const thr = player.getAverageThroughput('video'); // kbps
            if (Number.isFinite(thr) && thr > 0) s.thr = thr;
            const rep = player.getCurrentRepresentationForType('video');
            if (rep && Number.isFinite(rep.bandwidth)) s.play = rep.bandwidth / 1000;
        }
    } catch (e) {
        // Player mid-reinit; this tick stays a gap.
    }
    try {
        if (window.getCurrentCapKbps) s.cap = window.getCurrentCapKbps();
    } catch (e) { /* gap */ }

    chartSamples.push(s);
    if (chartSamples.length > CHART_MAX_SAMPLES) chartSamples.shift();
    updateChartLegend(s);
    drawChart();
}

function buildChartLegend() {
    const legend = document.getElementById('metricsLegend');
    legend.innerHTML = '';
    CHART_SERIES.forEach(({ key, label }) => {
        const item = document.createElement('span');
        item.className = 'legend-item';
        const swatch = document.createElement('span');
        swatch.className = 'legend-swatch';
        swatch.style.background = CHART_COLORS[key];
        const text = document.createElement('span');
        text.textContent = `${label}: `;
        const value = document.createElement('span');
        value.className = 'legend-value';
        value.id = `legend-value-${key}`;
        value.textContent = '—';
        item.append(swatch, text, value);
        legend.appendChild(item);
    });
}

function updateChartLegend(sample) {
    CHART_SERIES.forEach(({ key, fmt }) => {
        const el = document.getElementById(`legend-value-${key}`);
        if (el) el.textContent = sample[key] == null ? '—' : fmt(sample[key]);
    });
}

function drawChart() {
    // Replaced by the canvas renderer in the next task.
}

window.addEventListener('DOMContentLoaded', () => {
    buildChartLegend();
    setInterval(sampleMetrics, CHART_SAMPLE_MS);
});
