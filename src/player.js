// Get references to DOM elements
const videoElement = document.getElementById('videoPlayer');
const manifestInput = document.getElementById('manifestUrl');

// Initialize DashJS player
let player;
let currentManifestUrl = '';

function initializePlayer(manifestUrl) {
    // Store the manifest URL
    currentManifestUrl = manifestUrl;
    
    // Create a new DashJS player instance
    if (player) {
        player.destroy();
    }
    
    player = dashjs.MediaPlayer().create();

    // Setup custom ABR rules
    setupCustomABR();
    
    // Register the appropriate rule based on current selection
    registerCurrentRule();

    // Setup event listeners
    setupEventListeners();
    
    // Initialize the player with the video element and manifest URL
    player.initialize(videoElement, manifestUrl, true);
    
}

function registerCurrentRule() {
    // Get current rule from ruleButtons module
    const currentRule = window.getCurrentRule ? window.getCurrentRule() : 'custom';
    const ABR_RULES = window.getABRRules ? window.getABRRules() : {};
    const ruleConfig = ABR_RULES[currentRule];
    
    if (!ruleConfig) {
        console.error('Unknown rule:', currentRule);
        return;
    }
    
    if (ruleConfig.isCustom) {
        // Register custom rule
        try {
            player.addABRCustomRule('qualitySwitchRules', ruleConfig.factoryName, ruleConfig.factory);
            console.log('Registered custom rule:', ruleConfig.factoryName);
        } catch (e) {
            console.error('Error registering ABR rule:', e);
        }
    } else {
        // Default rule - handled in setupABRSettings
        console.log('Using default rule:', ruleConfig.ruleName);
    }
}

// Setup ABR settings based on current rule selection
function setupCustomABR() {
    // Get current rule from ruleButtons module
    const currentRule = window.getCurrentRule ? window.getCurrentRule() : 'custom';
    const ABR_RULES = window.getABRRules ? window.getABRRules() : {};
    const ruleConfig = ABR_RULES[currentRule];
    
    // Default: all rules disabled
    const rulesConfig = {
        throughputRule: { active: false },
        bolaRule: { active: false },
        insufficientBufferRule: { active: false },
        switchHistoryRule: { active: false },
        droppedFramesRule: { active: false },
        abandonRequestsRule: { active: false },
        l2ARule: { active: false },
        loLPRule: { active: false },
    };
    
    // If using a default rule, enable only that rule
    if (ruleConfig && !ruleConfig.isCustom && ruleConfig.ruleName) {
        rulesConfig[ruleConfig.ruleName] = { active: true };
        console.log('Enabling default rule:', ruleConfig.ruleName);
    }
    
    player.updateSettings({
        streaming: {
            abr: {
                autoSwitchBitrate: { audio: false, video: true },
                rules: rulesConfig
            }
        }
    });
    
    // Log settings to verify
    const settings = player.getSettings();
    console.log('ABR settings after update:', settings.streaming.abr);
}

function setupEventListeners() {
    player.on('error', function(event) {
        console.error('Player error:', event);
        alert('Error loading video. Please check the manifest URL.');
    });
    
    player.on('streamInitialized', function() {
        console.log('Stream initialized successfully');
        // Log current settings to verify rule registration
        const settings = player.getSettings();
        console.log('Current ABR settings:', settings.streaming.abr);
    });
    
    // Add event listener for quality changes to verify custom rule is working
    player.on('qualityChangeRendered', function(e) {
        console.log('Quality changed to:', e.newQuality, 'reason:', e.reason);
    });
}

// Load video from input field
function loadVideo() {
    const manifestUrl = manifestInput.value.trim();
    
    if (!manifestUrl) {
        alert('Please enter a DASH manifest URL');
        return;
    }
    
    console.log('Loading manifest:', manifestUrl);
    initializePlayer(manifestUrl);
}

// Initialize rule buttons and auto-load video on page load
window.addEventListener('DOMContentLoaded', function() {
    // Initialize rule buttons dynamically
    if (window.initializeRuleButtons) {
        window.initializeRuleButtons();
    }
    
    // Set up rule change callback to reinitialize player
    if (window.setRuleChangeCallback) {
        window.setRuleChangeCallback(function(ruleType) {
            if (player && currentManifestUrl) {
                console.log('Switching to', ruleType, 'rule');
                initializePlayer(currentManifestUrl);
            }
        });
    }
    
    // Auto-load the default video
    const defaultUrl = manifestInput.value;
    if (defaultUrl) {
        initializePlayer(defaultUrl);
    }
});
