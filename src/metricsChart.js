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

let chartHoverIndex = null; // sample index to crosshair (set by hover)

const CHART_MARGIN = { top: 26, right: 48, bottom: 24, left: 60 };

function resizeChartCanvas() {
    const canvas = document.getElementById('metricsChart');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    drawChart();
}

// Smallest "nice" number >= v (1/2/2.5/5 × power of 10).
function niceCeil(v) {
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) {
        if (m * pow >= v) return m * pow;
    }
    return 10 * pow;
}

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
    const canvas = document.getElementById('metricsChart');
    if (!canvas.width) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const plot = {
        x: CHART_MARGIN.left,
        y: CHART_MARGIN.top,
        w: W - CHART_MARGIN.left - CHART_MARGIN.right,
        h: H - CHART_MARGIN.top - CHART_MARGIN.bottom,
    };
    if (plot.w <= 0 || plot.h <= 0) return;

    // --- Scales ---
    let kbpsMax = 0;
    let bufMax = 0;
    chartSamples.forEach((s) => {
        ['thr', 'cap', 'play'].forEach((k) => { if (s[k] != null) kbpsMax = Math.max(kbpsMax, s[k]); });
        if (s.buf != null) bufMax = Math.max(bufMax, s.buf);
    });
    const leftMax = niceCeil(Math.max(1000, kbpsMax * 1.1));
    const rightMax = Math.max(30, niceCeil(bufMax * 1.1));

    const xAt = (i) => plot.x + plot.w * (1 - (chartSamples.length - 1 - i) / (CHART_MAX_SAMPLES - 1));
    const yLeft = (v) => plot.y + plot.h * (1 - v / leftMax);
    const yRight = (v) => plot.y + plot.h * (1 - v / rightMax);

    // --- Grid + axis labels ---
    ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.lineWidth = 1;
    const DIVISIONS = 4;
    for (let d = 0; d <= DIVISIONS; d++) {
        const y = plot.y + (plot.h * d) / DIVISIONS;
        ctx.strokeStyle = d === DIVISIONS ? CHART_COLORS.axis : CHART_COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(plot.x, y);
        ctx.lineTo(plot.x + plot.w, y);
        ctx.stroke();
        const frac = 1 - d / DIVISIONS;
        ctx.fillStyle = CHART_COLORS.label;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(leftMax * frac)}`, plot.x - 6, y);
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(rightMax * frac)}`, plot.x + plot.w + 6, y);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('kbps', plot.x - 54, plot.y - 10);
    ctx.textAlign = 'right';
    ctx.fillText('buffer (s)', plot.x + plot.w + 46, plot.y - 10);

    // Time ticks every 10 s (fixed grid; data slides through it).
    ctx.textBaseline = 'top';
    for (let t = 0; t <= 60; t += 10) {
        const x = plot.x + plot.w * (1 - t / 60);
        ctx.strokeStyle = CHART_COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(x, plot.y + plot.h);
        ctx.lineTo(x, plot.y + plot.h + 4);
        ctx.stroke();
        ctx.fillStyle = CHART_COLORS.label;
        ctx.textAlign = 'center';
        ctx.fillText(t === 0 ? 'now' : `-${t}s`, x, plot.y + plot.h + 7);
    }

    // --- Series ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y, plot.w, plot.h);
    ctx.clip();

    drawSeriesLine('thr', yLeft, false);
    drawSeriesLine('cap', yLeft, false);
    drawSeriesLine('buf', yRight, false);
    drawSeriesLine('play', yLeft, true);
    drawSwitchDots(yLeft);

    if (chartHoverIndex != null && chartSamples[chartHoverIndex]) {
        const x = xAt(chartHoverIndex);
        ctx.strokeStyle = CHART_COLORS.axis;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, plot.y);
        ctx.lineTo(x, plot.y + plot.h);
        ctx.stroke();
    }
    ctx.restore();

    function drawSeriesLine(key, yScale, stepped) {
        ctx.strokeStyle = CHART_COLORS[key];
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let penDown = false;
        let prevY = null;
        for (let i = 0; i < chartSamples.length; i++) {
            const v = chartSamples[i][key];
            if (v == null) { penDown = false; prevY = null; continue; }
            const x = xAt(i);
            const y = yScale(v);
            if (!penDown) {
                ctx.moveTo(x, y);
                penDown = true;
            } else if (stepped) {
                ctx.lineTo(x, prevY);
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            prevY = y;
        }
        ctx.stroke();
    }

    // A dot (with a 2px white ring) on each sample where the playing bitrate changed.
    function drawSwitchDots(yScale) {
        let prev = null;
        for (let i = 0; i < chartSamples.length; i++) {
            const v = chartSamples[i].play;
            if (v == null) continue;
            if (prev != null && v !== prev) {
                const x = xAt(i);
                const y = yScale(v);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = CHART_COLORS.play;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            }
            prev = v;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    buildChartLegend();
    resizeChartCanvas();
    window.addEventListener('resize', resizeChartCanvas);
    setInterval(sampleMetrics, CHART_SAMPLE_MS);
});
