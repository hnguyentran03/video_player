// Network speed emulation UI.
//
// Registers the throttling service worker (sw.js) and renders preset bandwidth
// buttons. Selecting a preset posts the byte/sec cap to the worker, which meters
// segment downloads so dash.js sees the emulated bandwidth. Mirrors the dynamic
// button pattern used by ruleButtons.js.

const NETWORK_PRESETS = {
    'unlimited': { name: 'Unlimited', kbps: null },
    '5000':      { name: '5 Mbps',   kbps: 5000 },
    '2000':      { name: '2 Mbps',   kbps: 2000 },
    '800':       { name: '800 kbps', kbps: 800 },
    '300':       { name: '300 kbps', kbps: 300 },
};

let currentPreset = 'unlimited'; // defaults to unthrottled

// --- Variable bandwidth mode (random walk) ---
// Each tick nudges the cap by a random step and posts it to the service
// worker; sw.js reads the cap live per chunk so ticks apply immediately.
const VARIABLE_TICK_MS = 500;
const VOLATILITY_STEP_FRACTION = { low: 0.05, medium: 0.15, high: 0.35 };

let variableTimer = null; // non-null while variable mode is running
let variableKbps = 0;     // current position of the walk
let appliedCapKbps = null; // last cap actually posted to the SW; null = unlimited

function initNetworkThrottle() {
    const container = document.getElementById('speedButtons');
    if (container) {
        container.innerHTML = '';
        Object.entries(NETWORK_PRESETS).forEach(([presetId, config]) => {
            const button = document.createElement('button');
            button.className = 'speed-btn';
            button.id = `speed-${presetId}-btn`;
            button.dataset.preset = presetId;
            button.textContent = config.name;
            button.onclick = () => setNetworkSpeed(presetId);
            if (presetId === currentPreset) {
                button.classList.add('active');
            }
            container.appendChild(button);
        });
    }

    if (!('serviceWorker' in navigator)) {
        console.warn('Service workers unsupported; network emulation disabled.');
        return;
    }

    navigator.serviceWorker.register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then(() => console.log('Network throttle service worker ready'))
        .catch((e) => console.error('Failed to register throttle service worker:', e));
}

function setNetworkSpeed(presetId) {
    const preset = NETWORK_PRESETS[presetId];
    if (!preset) {
        console.error('Unknown network preset:', presetId);
        return;
    }
    stopVariableMode();
    currentPreset = presetId;

    // Update button states
    document.querySelectorAll('.speed-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.preset === presetId);
    });

    const bytesPerSec = preset.kbps == null ? null : (preset.kbps * 1000) / 8;
    appliedCapKbps = preset.kbps;
    const controller = navigator.serviceWorker.controller;
    if (controller) {
        controller.postMessage({ type: 'setCap', bytesPerSec });
        console.log(`Network cap set to: ${preset.name}`);
    } else {
        // Happens only on the very first load before the worker takes control.
        console.warn('Service worker not controlling page yet; reload once to enable throttling.');
    }
}

function readVariableConfig() {
    const min = Number(document.getElementById('variableMin').value);
    const max = Number(document.getElementById('variableMax').value);
    const volatility = document.getElementById('variableVolatility').value;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || min >= max) {
        console.warn('Variable mode: invalid bounds (need 0 < min < max).');
        return null;
    }
    return { min, max, maxStep: (max - min) * VOLATILITY_STEP_FRACTION[volatility] };
}

function toggleVariableMode() {
    if (variableTimer !== null) {
        stopVariableMode();
    } else {
        startVariableMode();
    }
}

function startVariableMode() {
    const config = readVariableConfig();
    if (!config) return;
    if (!navigator.serviceWorker.controller) {
        console.warn('Service worker not controlling page yet; reload once to enable throttling.');
        return;
    }

    // Variable mode replaces any fixed preset.
    currentPreset = null;
    document.querySelectorAll('.speed-btn').forEach((btn) => btn.classList.remove('active'));
    const toggle = document.getElementById('variableToggle');
    toggle.classList.add('active');
    toggle.textContent = 'Stop Variable';

    variableKbps = (config.min + config.max) / 2;
    postVariableCap();
    variableTimer = setInterval(() => {
        // Sum of two uniform draws biases toward small steps (gaussian-ish).
        const step = (Math.random() + Math.random() - 1) * config.maxStep;
        variableKbps = Math.min(config.max, Math.max(config.min, variableKbps + step));
        postVariableCap();
    }, VARIABLE_TICK_MS);
    console.log(`Variable bandwidth started: ${config.min}-${config.max} kbps`);
}

function postVariableCap() {
    appliedCapKbps = variableKbps;
    const controller = navigator.serviceWorker.controller;
    if (controller) {
        controller.postMessage({ type: 'setCap', bytesPerSec: (variableKbps * 1000) / 8 });
    }
    document.getElementById('variableReadout').textContent =
        `Current: ${Math.round(variableKbps)} kbps`;
}

// Stops the walk but leaves the last posted cap in place (a preset click
// will overwrite it).
function stopVariableMode() {
    if (variableTimer === null) return;
    clearInterval(variableTimer);
    variableTimer = null;
    const toggle = document.getElementById('variableToggle');
    toggle.classList.remove('active');
    toggle.textContent = 'Start Variable';
    console.log('Variable bandwidth stopped');
}

function getCurrentCapKbps() {
    return appliedCapKbps;
}

window.initNetworkThrottle = initNetworkThrottle;
window.setNetworkSpeed = setNetworkSpeed;
window.toggleVariableMode = toggleVariableMode;
window.stopVariableMode = stopVariableMode;
window.getCurrentCapKbps = getCurrentCapKbps;

window.addEventListener('DOMContentLoaded', initNetworkThrottle);
