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
    currentPreset = presetId;

    // Update button states
    document.querySelectorAll('.speed-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.preset === presetId);
    });

    const bytesPerSec = preset.kbps == null ? null : (preset.kbps * 1000) / 8;
    const controller = navigator.serviceWorker.controller;
    if (controller) {
        controller.postMessage({ type: 'setCap', bytesPerSec });
        console.log(`Network cap set to: ${preset.name}`);
    } else {
        // Happens only on the very first load before the worker takes control.
        console.warn('Service worker not controlling page yet; reload once to enable throttling.');
    }
}

window.initNetworkThrottle = initNetworkThrottle;
window.setNetworkSpeed = setNetworkSpeed;

window.addEventListener('DOMContentLoaded', initNetworkThrottle);
