// Get references to DOM elements
const videoElement = document.getElementById('videoPlayer');
const manifestInput = document.getElementById('manifestUrl');

// Initialize DashJS player
let player;

function initializePlayer(manifestUrl) {
    // Create a new DashJS player instance
    if (player) {
        player.destroy();
    }
    
    player = dashjs.MediaPlayer().create();

    // Setup custom ABR rules
    setupABR();

    // Setup event listeners
    setupEventListeners();
    
    // Initialize the player with the video element and manifest URL
    player.initialize(videoElement, manifestUrl, true);
    
}

function setupABR() {
    // Only use settings that are supported in DashJS 4.7.4
    player.updateSettings({
        streaming: {
            abr: {
                autoSwitchBitrate: { audio: false, video: true }
            },
            buffer: {
                fastSwitchEnabled: false
            }
        }
    });
}

function setupEventListeners() {
    player.on('error', function(event) {
        console.error('Player error:', event);
        alert('Error loading video. Please check the manifest URL.');
    });
    
    player.on('streamInitialized', function() {
        console.log('Stream initialized successfully');
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

// Auto-load the default video on page load
window.addEventListener('DOMContentLoaded', function() {
    const defaultUrl = manifestInput.value;
    if (defaultUrl) {
        initializePlayer(defaultUrl);
    }
});
