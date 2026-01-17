// Get references to DOM elements
const videoElement = document.getElementById('videoPlayer');
const manifestInput = document.getElementById('manifestUrl');

// Rules registry - Add new rules here to make them available
const ABR_RULES = {
    'custom': {
        name: 'Custom Bitrate Rule',
        factoryName: 'CustomBitrateRule',
        factory: CustomBitrateRule
    },
    'lowest': {
        name: 'Lowest Bitrate Rule',
        factoryName: 'LowestBitrateRule',
        factory: LowestBitrateRule
    },
    'highest': {
        name: 'Highest Bitrate Rule',
        factoryName: 'HighestBitrateRule',
        factory: HighestBitrateRule
    }
};

// Initialize DashJS player
let player;
let currentRule = 'custom'; // Track current rule (defaults to first rule in registry)
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
    // Get the rule configuration from registry
    const ruleConfig = ABR_RULES[currentRule];
    
    if (!ruleConfig) {
        console.error('Unknown rule:', currentRule);
        return;
    }
    
    try {
        // Register the rule using the factory from the registry
        player.addABRCustomRule('qualitySwitchRules', ruleConfig.factoryName, ruleConfig.factory);
        console.log('Registered', ruleConfig.factoryName);
    } catch (e) {
        console.error('Error registering ABR rule:', e);
    }
}

function switchRule(ruleType) {
    if (currentRule === ruleType) {
        return; // Already using this rule
    }
    
    // Validate rule exists
    if (!ABR_RULES[ruleType]) {
        console.error('Unknown rule type:', ruleType);
        return;
    }
    
    currentRule = ruleType;
    
    // Update button states 
    const ruleButtons = document.querySelectorAll('.rule-btn');
    ruleButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.ruleType === ruleType) {
            btn.classList.add('active');
        }
    });
    
    // Update current rule text
    const currentRuleText = document.getElementById('currentRule');
    const ruleConfig = ABR_RULES[ruleType];
    currentRuleText.textContent = `Current: ${ruleConfig.name}`;
    
    // If player is already initialized, reinitialize with the new rule
    if (player && currentManifestUrl) {
        console.log('Switching to', ruleType, 'rule');
        initializePlayer(currentManifestUrl);
    }
}

function initializeRuleButtons() {
    const ruleButtonsContainer = document.getElementById('ruleButtons');
    if (!ruleButtonsContainer) {
        console.error('Rule buttons container not found');
        return;
    }
    
    // Clear existing buttons
    ruleButtonsContainer.innerHTML = '';
    
    // Get the first rule as default
    const defaultRule = Object.keys(ABR_RULES)[0];
    currentRule = defaultRule;
    
    // Create buttons for each rule
    Object.entries(ABR_RULES).forEach(([ruleId, ruleConfig], index) => {
        const button = document.createElement('button');
        button.className = 'rule-btn';
        button.id = `${ruleId}RuleBtn`;
        button.dataset.ruleType = ruleId;
        button.textContent = ruleConfig.name;
        button.onclick = () => switchRule(ruleId);
        
        // Set first button as active by default
        if (index === 0) {
            button.classList.add('active');
        }
        
        ruleButtonsContainer.appendChild(button);
    });
    
    // Update current rule text
    const currentRuleText = document.getElementById('currentRule');
    if (currentRuleText) {
        currentRuleText.textContent = `Current: ${ABR_RULES[defaultRule].name}`;
    }
}

// Setup ABR settings
// Disable all default ABR rules so custom rule takes precedence
function setupCustomABR() {
    player.updateSettings({
        streaming: {
            abr: {
                autoSwitchBitrate: { audio: false, video: true },
                rules: {
                    throughputRule: { active: false },
                    bolaRule: { active: false },
                    insufficientBufferRule: { active: false },
                    switchHistoryRule: { active: false },
                    droppedFramesRule: { active: false },
                    abandonRequestsRule: { active: false },
                    l2ARule: { active: false },
                    loLPRule: { active: false },
                },
                enableSupplementalPropertyAdaptationSetSwitching: false
            },
            buffer: {
                fastSwitchEnabled: false,
                bufferTimeDefault: 30,
                bufferTimeAtTopQuality: 45
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
    initializeRuleButtons();
    
    // Auto-load the default video
    const defaultUrl = manifestInput.value;
    if (defaultUrl) {
        initializePlayer(defaultUrl);
    }
});

// Make functions available globally
window.switchRule = switchRule;
