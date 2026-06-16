//Add new rules here to make them available
const ABR_RULES = {
    // Custom rules
    'custom': {
        name: 'Custom Bitrate',
        factoryName: 'CustomBitrateRule',
        factory: CustomBitrateRule,
        isCustom: true
    },
    'lowest': {
        name: 'Lowest Bitrate',
        factoryName: 'LowestBitrateRule',
        factory: LowestBitrateRule,
        isCustom: true
    },
    'highest': {
        name: 'Highest Bitrate',
        factoryName: 'HighestBitrateRule',
        factory: HighestBitrateRule,
        isCustom: true
    },
    
    // Default DashJS ABR rules
    'throughput': {
        name: 'Throughput',
        ruleName: 'throughputRule',
        isCustom: false
    },
    'bola': {
        name: 'BOLA',
        ruleName: 'bolaRule',
        isCustom: false
    },
    'insufficient-buffer': {
        name: 'Insufficient Buffer',
        ruleName: 'insufficientBufferRule',
        isCustom: false
    },
    'switch-history': {
        name: 'Switch History',
        ruleName: 'switchHistoryRule',
        isCustom: false
    },
    'dropped-frames': {
        name: 'Dropped Frames',
        ruleName: 'droppedFramesRule',
        isCustom: false
    },
    'abandon-requests': {
        name: 'Abandon Requests',
        ruleName: 'abandonRequestsRule',
        isCustom: false
    },
    'l2a': {
        name: 'L2A',
        ruleName: 'l2ARule',
        isCustom: false
    },
    'lolp': {
        name: 'LoLP',
        ruleName: 'loLPRule',
        isCustom: false
    }
};

let currentRule = 'custom'; // Track current rule (defaults to first rule in registry)
let onRuleChangeCallback = null;

// Set callback for when rule changes
function setRuleChangeCallback(callback) {
    onRuleChangeCallback = callback;
}

function getCurrentRule() {
    return currentRule;
}

function getABRRules() {
    return ABR_RULES;
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
    
    // Notify callback if set
    if (onRuleChangeCallback) {
        onRuleChangeCallback(ruleType);
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

// Make functions available globally
window.switchRule = switchRule;
window.getCurrentRule = getCurrentRule;
window.getABRRules = getABRRules;
window.setRuleChangeCallback = setRuleChangeCallback;
window.initializeRuleButtons = initializeRuleButtons;