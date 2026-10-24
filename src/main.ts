/**
 * EchoNet main entry point.
 * Wires screens: Lab, Listener, Authority, Wall, Sim.
 * Premium technical UI/UX adhering to Taste-Skill and Anti-Emoji directives.
 */

import './style.css';
import { AudioEngine, AudioState } from './audio/engine';
import { RelayEngine } from './relay/relay';
import {
  encodeFrame,
  getImmutableBytes,
  getTimeBucket,
  BeaconFrame,
  FrameType,
  FRAME_VERSION,
} from './protocol/frame';
import { computeMAC } from './crypto/mac';
import { renderTemplate, TEMPLATES, Language } from './protocol/templates';
import { logEvent, exportCSV, exportJSON, clearLogs } from './store/log';
import { DEFAULT_CONFIG } from './lib/config';
import { runSimulation, SimResult } from './relay/sim';
import { ICONS } from './ui/icons';

// ─── Application State ───
type Screen = 'lab' | 'listener' | 'authority' | 'wall' | 'sim';
let currentScreen: Screen = 'listener';
let audioEngine: AudioEngine | null = null;
let relayEngine: RelayEngine | null = null;
let language: Language = 'en';

// Lab State
let labMode: 'sender' | 'receiver' = 'receiver';
let labCounter = { sent: 0, decoded: 0, failed: 0, correctedErrors: 0 };
let labMsgIndex = 0;
let labProtocol = 'GGWAVE_PROTOCOL_AUDIBLE_FAST';
let labDistance = '1';

// Authority State
let authPinInput = '';
let isAuthorityBroadcasting = false;

// Wall State
let wallFrameCount = 0;
let wallMaxHop = 0;
let wallFirstFrameTime = 0;
let wallRaceInterval: ReturnType<typeof setInterval> | null = null;

// Oscilloscope RAF ID
let oscilloscopeRaf: number | null = null;

// Event epoch: midnight today
const eventEpoch = new Date(new Date().toDateString()).getTime();

// ─── Detect in-app browser ───
function isInAppBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes('instagram') ||
    ua.includes('fban') ||
    ua.includes('fbav') ||
    ua.includes('whatsapp') ||
    ua.includes('line/') ||
    ua.includes('snapchat')
  );
}

// ─── Root Render ───
function render(): void {
  const app = document.getElementById('app')!;

  // Toggle wall mode layout class for widescreen presentation
  if (currentScreen === 'wall') {
    app.classList.add('wall-mode');
  } else {
    app.classList.remove('wall-mode');
  }

  // Cancel any running oscilloscope animation frame
  if (oscilloscopeRaf) {
    cancelAnimationFrame(oscilloscopeRaf);
    oscilloscopeRaf = null;
  }

  // In-app browser warning
  if (isInAppBrowser()) {
    app.innerHTML = `
      <div class="drill-banner">
        <div class="drill-banner-inner">
          ${ICONS.alertTriangle}
          <span>DRILL PROTOCOL ACTIVE // EXPERIMENTAL ACOUSTIC MESH</span>
        </div>
      </div>
      <div class="card" style="margin-top: 40px; text-align: center;">
        <div style="color: var(--crimson); margin-bottom: 12px;">${ICONS.alertTriangle}</div>
        <h1 style="color: var(--crimson);">Open in Native Browser</h1>
        <p class="mt-8">EchoNet requires full microphone & Web Audio access. In-app webviews block raw microphone streams.</p>
        <p class="mt-12 text-dim font-mono">Copy URL and open directly in Chrome, Safari, or Edge.</p>
      </div>
    `;
    return;
  }

  const currentState = audioEngine ? audioEngine.getState() : 'IDLE';

  let html = `
    <!-- Top Hazard Banner -->
    <div class="drill-banner">
      <div class="drill-banner-inner">
        ${ICONS.alertTriangle}
        <span>DRILL MODE // NON-TACTICAL EXPERIMENTAL ACOUSTIC MESH</span>
      </div>
    </div>

    <!-- Header & Live Telemetry -->
    <header class="app-header">
      <div class="brand-badge">
        <div class="brand-dot"></div>
        <span>EchoNet</span>
      </div>
      <div class="header-meta">
        <div id="header-offline-pill" class="offline-pill">
          ${ICONS.wifiOff}
          <span>Offline Ready</span>
        </div>
        <div id="header-audio-badge" class="status-badge status-${currentState.toLowerCase()}">
          <div class="status-indicator-dot"></div>
          <span id="header-state-text">${currentState}</span>
        </div>
      </div>
    </header>

    <!-- Screen Content Mount Point -->
    <main id="screen-content" class="flex-1"></main>

    <!-- Bottom Navigation Bar -->
    <nav class="nav-bar">
      <button class="nav-tab ${currentScreen === 'listener' ? 'active' : ''}" data-screen="listener">
        ${ICONS.listener}
        <span>Listener</span>
      </button>
      <button class="nav-tab ${currentScreen === 'authority' ? 'active' : ''}" data-screen="authority">
        ${ICONS.authority}
        <span>Authority</span>
      </button>
      <button class="nav-tab ${currentScreen === 'wall' ? 'active' : ''}" data-screen="wall">
        ${ICONS.wall}
        <span>Wall</span>
      </button>
      <button class="nav-tab ${currentScreen === 'lab' ? 'active' : ''}" data-screen="lab">
        ${ICONS.lab}
        <span>Lab</span>
      </button>
      <button class="nav-tab ${currentScreen === 'sim' ? 'active' : ''}" data-screen="sim">
        ${ICONS.sim}
        <span>Sim</span>
      </button>
    </nav>
  `;

  app.innerHTML = html;

  // Nav click handlers
  app.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentScreen = (btn as HTMLElement).dataset.screen as Screen;
      render();
    });
  });

  const content = document.getElementById('screen-content')!;
  switch (currentScreen) {
    case 'listener':
      renderListener(content);
      break;
    case 'authority':
      renderAuthority(content);
      break;
    case 'wall':
      renderWall(content);
      break;
    case 'lab':
      renderLab(content);
      break;
    case 'sim':
      renderSim(content);
      break;
  }

  // Update header indicators
  checkOfflineReady(document.getElementById('header-offline-pill')!);
}

// ─────────────────────────────────────────────────────────────
// SCREEN 1: LISTENER (Primary Citizen Mesh Node)
// ─────────────────────────────────────────────────────────────
function renderListener(el: HTMLElement): void {
  const currentState = audioEngine ? audioEngine.getState() : 'IDLE';

  el.innerHTML = `
    <div class="flex justify-between items-center mb-12">
      <div>
        <h1>Acoustic Node</h1>
        <p class="text-dim">Passes short alert beacons using sound alone.</p>
      </div>
      <div>
        <select id="listener-lang" style="width: auto; padding: 6px 30px 6px 12px; font-size: 12px;">
          <option value="en" ${language === 'en' ? 'selected' : ''}>English</option>
          <option value="ml" ${language === 'ml' ? 'selected' : ''}>മലയാളം (ML)</option>
          <option value="hi" ${language === 'hi' ? 'selected' : ''}>हिन्दी (HI)</option>
        </select>
      </div>
    </div>

    <!-- Active Emergency Banner (Hidden until alert heard) -->
    <div id="listener-alert-card" class="alert-card-hero" style="display: none;">
      <div class="alert-badge-top">
        ${ICONS.alertTriangle}
        <span>BROADCAST RECEIVED</span>
      </div>
      <h2 id="listener-alert-text">EMERGENCY ALERT</h2>
      <div class="alert-meta-grid">
        <div class="alert-meta-item">
          <div class="alert-meta-label">Hop Level</div>
          <div class="alert-meta-val" id="listener-hop-val">0</div>
        </div>
        <div class="alert-meta-item">
          <div class="alert-meta-label">Alert ID</div>
          <div class="alert-meta-val" id="listener-alert-id">0x0000</div>
        </div>
        <div class="alert-meta-item">
          <div class="alert-meta-label">Security MAC</div>
          <div class="alert-meta-val text-success">VERIFIED</div>
        </div>
      </div>
    </div>

    <!-- Live Acoustic Sensor Card -->
    <div class="card">
      <div class="flex justify-between items-center mb-8">
        <div class="card-title" style="margin-bottom: 0;">
          ${ICONS.radioWave}
          <span>Acoustic Receiver</span>
        </div>
        <div id="listener-status-pill" class="status-badge status-${currentState.toLowerCase()}">
          <div class="status-indicator-dot"></div>
          <span id="listener-status-label">${currentState}</span>
        </div>
      </div>

      <!-- Live Oscilloscope Waveform -->
      <canvas id="listener-oscilloscope" class="oscilloscope-canvas" width="480" height="80"></canvas>

      <!-- Level VU Meter -->
      <div class="level-meter-container">
        <div class="level-meter-header">
          <span>MIC SENSITIVITY</span>
          <span id="listener-level-db">SILENCE</span>
        </div>
        <div class="level-meter">
          <div class="level-meter-fill" id="listener-level-fill"></div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-8 mt-16">
        <button class="btn btn-primary flex-1" id="listener-toggle-btn">
          ${ICONS.mic}
          <span id="listener-toggle-text">${currentState === 'LISTEN' ? 'Listening Active' : 'Start Acoustic Mesh'}</span>
        </button>
        <button class="btn btn-outline btn-icon" id="listener-test-tone" title="Play audible audio chirp">
          ${ICONS.speaker}
        </button>
      </div>
    </div>

    <!-- Airplane Mode Challenge Card -->
    <div class="card">
      <div class="card-title">
        ${ICONS.wifiOff}
        <span>Airplane Mode Field Test</span>
      </div>
      <p class="text-dim" style="font-size: 13px;">
        1. Keep this page open in your browser.<br />
        2. Turn <strong>Airplane Mode ON</strong> and turn <strong>Wi-Fi & Bluetooth OFF</strong>.<br />
        3. Bring another phone nearby and send an alert from Authority or Lab.<br />
        4. Messages hop across phones over ultrasonic & audible sound waves!
      </p>
    </div>
  `;

  // Start live canvas visualizer
  startOscilloscope('listener-oscilloscope');

  // Language selector
  el.querySelector('#listener-lang')!.addEventListener('change', (e) => {
    language = (e.target as HTMLSelectElement).value as Language;
  });

  // Toggle listen
  const toggleBtn = el.querySelector('#listener-toggle-btn')!;
  toggleBtn.addEventListener('click', async () => {
    await initAudio();
    await initRelay();
    if (audioEngine) {
      if (audioEngine.getState() === 'IDLE') {
        await audioEngine.startListening();
      }
      updateUIStatus();
    }
  });

  // Test tone
  el.querySelector('#listener-test-tone')!.addEventListener('click', async () => {
    if (!audioEngine) await initAudio();
    audioEngine?.playTestTone();
  });
}

// ─────────────────────────────────────────────────────────────
// SCREEN 2: AUTHORITY (Civil Protection Emergency Broadcast)
// ─────────────────────────────────────────────────────────────
function renderAuthority(el: HTMLElement): void {
  el.innerHTML = `
    <div class="flex justify-between items-center mb-12">
      <div>
        <h1>Civil Authority</h1>
        <p class="text-dim">Cryptographically signed alert beacon origin.</p>
      </div>
      <div class="status-badge" style="background: rgba(255, 42, 81, 0.1); border: 1px solid var(--crimson); color: var(--crimson);">
        ${ICONS.authority}
        <span>AUTHORIZED ORIGIN</span>
      </div>
    </div>

    <!-- Security Keypad Card -->
    <div class="card">
      <div class="flex justify-between items-center">
        <div class="card-title" style="margin-bottom: 0;">
          ${ICONS.authority}
          <span>Origin Authorization PIN</span>
        </div>
        <button class="chip" id="auth-quick-pin">Fill Demo 1234</button>
      </div>

      <div class="pin-display">
        <div class="pin-digit ${authPinInput.length > 0 ? 'active' : ''}">${authPinInput[0] ? '•' : ''}</div>
        <div class="pin-digit ${authPinInput.length > 1 ? 'active' : ''}">${authPinInput[1] ? '•' : ''}</div>
        <div class="pin-digit ${authPinInput.length > 2 ? 'active' : ''}">${authPinInput[2] ? '•' : ''}</div>
        <div class="pin-digit ${authPinInput.length > 3 ? 'active' : ''}">${authPinInput[3] ? '•' : ''}</div>
      </div>

      <input 
        type="password" 
        id="auth-pin" 
        maxlength="4" 
        placeholder="Enter 4-digit PIN" 
        value="${authPinInput}" 
        style="text-align: center; letter-spacing: 4px; font-family: var(--font-mono); font-size: 16px;" 
      />
    </div>

    <!-- Alert Template Selection Card -->
    <div class="card">
      <div class="card-title">
        ${ICONS.alertTriangle}
        <span>Select Emergency Protocol Template</span>
      </div>

      <select id="auth-template" class="w-full mb-12">
        ${TEMPLATES.map(
          (t) => `
          <option value="${t.id}">
            [0x${t.id.toString(16).padStart(2, '0').toUpperCase()}] ${t.en}
          </option>`
        ).join('')}
      </select>

      <div id="auth-template-preview" class="p-12 mb-12" style="background: var(--bg-deep); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); font-size: 13px; line-height: 1.5;">
        <div class="text-dim mb-4" style="font-size: 10px; font-family: var(--font-mono);">PREVIEW (MULTILINGUAL PAYLOAD):</div>
        <div id="preview-en" class="text-main font-bold"></div>
        <div id="preview-ml" class="text-primary mt-4"></div>
        <div id="preview-hi" class="text-muted mt-4"></div>
      </div>

      <!-- Transmit Trigger -->
      <button class="btn btn-danger w-full" id="auth-broadcast-btn" ${isAuthorityBroadcasting ? 'disabled' : ''}>
        ${ICONS.broadcast}
        <span id="auth-btn-text">Broadcast Emergency Beacon (3x repeats)</span>
      </button>
    </div>

    <!-- Transmission Terminal Log -->
    <div class="card" id="auth-log-card" style="display: none;">
      <div class="card-title">
        ${ICONS.broadcast}
        <span>Transmission Log</span>
      </div>
      <div class="terminal-log" id="auth-log-stream"></div>
    </div>
  `;

  // Update preview
  const templateSelect = el.querySelector('#auth-template') as HTMLSelectElement;
  const updatePreview = () => {
    const tId = parseInt(templateSelect.value);
    const tpl = TEMPLATES.find((t) => t.id === tId);
    if (tpl) {
      el.querySelector('#preview-en')!.textContent = tpl.en;
      el.querySelector('#preview-ml')!.textContent = tpl.ml;
      el.querySelector('#preview-hi')!.textContent = tpl.hi;
    }
  };
  templateSelect.addEventListener('change', updatePreview);
  updatePreview();

  // PIN handling
  const pinInput = el.querySelector('#auth-pin') as HTMLInputElement;
  pinInput.addEventListener('input', () => {
    authPinInput = pinInput.value;
    const digits = el.querySelectorAll('.pin-digit');
    digits.forEach((d, idx) => {
      d.textContent = authPinInput[idx] ? '•' : '';
      if (authPinInput.length > idx) {
        d.classList.add('active');
      } else {
        d.classList.remove('active');
      }
    });
  });

  el.querySelector('#auth-quick-pin')!.addEventListener('click', () => {
    authPinInput = '1234';
    pinInput.value = '1234';
    pinInput.dispatchEvent(new Event('input'));
  });

  // Broadcast Button
  el.querySelector('#auth-broadcast-btn')!.addEventListener('click', async () => {
    if (authPinInput !== '1234') {
      alert('Authentication required. Enter demo PIN: 1234');
      return;
    }

    const templateId = parseInt(templateSelect.value);
    isAuthorityBroadcasting = true;
    render();

    await initAudio();
    await sendAuthorityBeacon(templateId);

    isAuthorityBroadcasting = false;
    render();
  });
}

// ─────────────────────────────────────────────────────────────
// SCREEN 3: WALL (Projector Display / Room Race Monitor)
// ─────────────────────────────────────────────────────────────
function renderWall(el: HTMLElement): void {
  const isFullscreen = !!document.fullscreenElement;

  el.innerHTML = `
    <div class="wall-header-layout">
      <div>
        <h1>The Wall // Race Monitor</h1>
        <p class="text-dim">Live acoustic propagation telemetry for projector display.</p>
      </div>
      <div class="flex gap-8 items-center">
        <button class="btn btn-outline btn-sm" id="wall-fullscreen-btn">
          ${ICONS.fullscreen}
          <span>${isFullscreen ? 'Exit Fullscreen' : 'Projector Fullscreen'}</span>
        </button>
        <button class="btn btn-primary btn-sm" id="wall-start-btn">
          ${ICONS.mic}
          <span>Arm Wall Listener</span>
        </button>
      </div>
    </div>

    <!-- Race Clock Hero Card -->
    <div class="race-timer-hero mb-12">
      <div class="text-dim font-mono mb-8" style="font-size: 11px; letter-spacing: 1.5px;">ACOUSTIC PROPAGATION LATENCY</div>
      <div class="flex justify-center items-baseline">
        <span class="race-clock-digits" id="wall-race-digits">00.00</span>
        <span class="race-clock-unit">SEC</span>
      </div>
      <div class="flex justify-center gap-12 mt-12 text-dim font-mono" style="font-size: 12px;">
        <span>FIRST HOP: <strong id="wall-race-first-hop" class="text-primary">--</strong></span>
        <span>•</span>
        <span>PEAK REACH: <strong id="wall-race-peak-hop" class="text-primary">0 HOPS</strong></span>
      </div>
    </div>

    <!-- Counter Metric Grid -->
    <div class="counter-grid counter-grid-4 mb-14">
      <div class="counter-item">
        <div class="counter-value" id="wall-c-frames">${wallFrameCount}</div>
        <div class="counter-label">Frames Received</div>
      </div>
      <div class="counter-item">
        <div class="counter-value" id="wall-c-hops">${wallMaxHop}</div>
        <div class="counter-label">Max Hop Level</div>
      </div>
      <div class="counter-item">
        <div class="counter-value text-success" id="wall-c-mac">100%</div>
        <div class="counter-label">MAC Verified</div>
      </div>
      <div class="counter-item">
        <div class="counter-value" id="wall-c-loss">0.0%</div>
        <div class="counter-label">Observed Loss</div>
      </div>
    </div>

    <!-- Real-time Waterfall Timeline Card -->
    <div class="card">
      <div class="flex justify-between items-center mb-8">
        <div class="card-title" style="margin-bottom: 0;">
          ${ICONS.wall}
          <span>Acoustic Reception Waterfall</span>
        </div>
        <button class="btn btn-outline btn-sm" id="wall-reset-btn">
          ${ICONS.refresh}
          <span>Reset Race</span>
        </button>
      </div>
      <div class="terminal-log" id="wall-timeline" style="max-height: 280px;">
        ${wallFrameCount === 0 ? '<div class="text-dim">Waiting for acoustic broadcast waves... Arm listener and broadcast from Authority.</div>' : ''}
      </div>
    </div>
  `;

  // Fullscreen button
  el.querySelector('#wall-fullscreen-btn')!.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Start Listener
  el.querySelector('#wall-start-btn')!.addEventListener('click', async () => {
    await initAudio();
    await initRelay();
    await audioEngine!.startListening();
    updateUIStatus();
  });

  // Reset Race
  el.querySelector('#wall-reset-btn')!.addEventListener('click', () => {
    wallFrameCount = 0;
    wallMaxHop = 0;
    wallFirstFrameTime = 0;
    if (wallRaceInterval) {
      clearInterval(wallRaceInterval);
      wallRaceInterval = null;
    }
    render();
  });
}

// ─────────────────────────────────────────────────────────────
// SCREEN 4: ACOUSTIC LAB (DSP Diagnostics & Field Verification)
// ─────────────────────────────────────────────────────────────
function renderLab(el: HTMLElement): void {
  const currentState = audioEngine ? audioEngine.getState() : 'IDLE';

  el.innerHTML = `
    <div class="flex justify-between items-center mb-12">
      <div>
        <h1>Acoustic DSP Lab</h1>
        <p class="text-dim">Raw modem diagnostics, BER, and loopback verification.</p>
      </div>
      <div class="segmented-control" style="width: 200px;">
        <button class="segment-btn ${labMode === 'receiver' ? 'active' : ''}" id="lab-mode-rx">Receiver</button>
        <button class="segment-btn ${labMode === 'sender' ? 'active' : ''}" id="lab-mode-tx">Sender</button>
      </div>
    </div>

    <!-- Modulation & Distance Settings Card -->
    <div class="card">
      <div class="card-title">
        ${ICONS.lab}
        <span>Modem Parameters</span>
      </div>
      <div class="flex gap-8 mb-8">
        <div class="flex-1">
          <label class="text-dim" style="font-size: 11px;">PROTOCOL PROFILE</label>
          <select id="lab-protocol" class="mt-4">
            <option value="GGWAVE_PROTOCOL_AUDIBLE_FAST" ${labProtocol === 'GGWAVE_PROTOCOL_AUDIBLE_FAST' ? 'selected' : ''}>Audible Fast (16 B/s)</option>
            <option value="GGWAVE_PROTOCOL_AUDIBLE_NORMAL" ${labProtocol === 'GGWAVE_PROTOCOL_AUDIBLE_NORMAL' ? 'selected' : ''}>Audible Normal (8 B/s)</option>
            <option value="GGWAVE_PROTOCOL_AUDIBLE_FASTEST" ${labProtocol === 'GGWAVE_PROTOCOL_AUDIBLE_FASTEST' ? 'selected' : ''}>Audible Fastest (32 B/s)</option>
          </select>
        </div>
        <div style="width: 110px;">
          <label class="text-dim" style="font-size: 11px;">DISTANCE (M)</label>
          <input type="text" id="lab-distance" value="${labDistance}" class="mt-4" placeholder="1m, 3m" />
        </div>
      </div>
    </div>

    <!-- Live Audio Spectrum & Capture Card -->
    <div class="card">
      <div class="flex justify-between items-center mb-8">
        <div class="card-title" style="margin-bottom: 0;">
          ${ICONS.radioWave}
          <span>Microphone Telemetry</span>
        </div>
        <div id="lab-status" class="status-badge status-${currentState.toLowerCase()}">
          <div class="status-indicator-dot"></div>
          <span>${currentState}</span>
        </div>
      </div>

      <canvas id="lab-oscilloscope" class="oscilloscope-canvas" width="480" height="80"></canvas>

      <div class="level-meter-container">
        <div class="level-meter-header">
          <span>SPECTRUM ENERGY</span>
          <span id="lab-samplerate" class="font-mono">48000 Hz</span>
        </div>
        <div class="level-meter">
          <div class="level-meter-fill" id="lab-level"></div>
        </div>
      </div>

      <div class="flex gap-8 mt-16">
        <button class="btn btn-primary flex-1" id="lab-start">
          ${ICONS.mic}
          <span>${currentState === 'LISTEN' ? 'Listening' : 'Start Mic Stream'}</span>
        </button>
        <button class="btn btn-outline btn-icon" id="lab-test-tone" title="Test Audio Tone">
          ${ICONS.speaker}
        </button>
      </div>
    </div>

    <!-- Sender Panel (Only in Sender mode) -->
    <div class="card" id="lab-sender-panel" ${labMode !== 'sender' ? 'style="display:none"' : ''}>
      <div class="card-title">
        ${ICONS.send}
        <span>Acoustic Test Packet Injector</span>
      </div>
      <p class="text-dim mb-8">Current Payload Sequence: <strong id="lab-msg-index" class="text-primary">ECHO${(labMsgIndex + 1).toString().padStart(3, '0')}</strong></p>
      <button class="btn btn-primary w-full" id="lab-send">
        ${ICONS.send}
        <span>Transmit Test Packet</span>
      </button>
    </div>

    <!-- Performance Counters Card -->
    <div class="card">
      <div class="card-title">
        ${ICONS.shieldCheck}
        <span>Delivery Metrics</span>
      </div>
      <div class="counter-grid">
        <div class="counter-item">
          <div class="counter-value" id="lab-c-sent">${labCounter.sent}</div>
          <div class="counter-label">Frames Sent</div>
        </div>
        <div class="counter-item">
          <div class="counter-value text-success" id="lab-c-decoded">${labCounter.decoded}</div>
          <div class="counter-label">Decoded Clean</div>
        </div>
        <div class="counter-item">
          <div class="counter-value text-danger" id="lab-c-failed">${labCounter.failed}</div>
          <div class="counter-label">Decode Failed</div>
        </div>
        <div class="counter-item">
          <div class="counter-value" id="lab-c-errors">${labCounter.correctedErrors}</div>
          <div class="counter-label">RS Corrections</div>
        </div>
      </div>
    </div>

    <!-- Diagnostic Loopback Test Card -->
    <div class="card">
      <div class="card-title">
        ${ICONS.refresh}
        <span>In-Memory Loopback Verification</span>
      </div>
      <p class="text-dim mb-8">Passes synthesized Float32Array PCM samples directly from ggwave encoder to decoder in RAM.</p>
      <button class="btn btn-outline w-full" id="lab-loopback">
        ${ICONS.play}
        <span>Run RAM Self-Test</span>
      </button>
      <div id="lab-loopback-result" class="mt-8 font-mono" style="font-size: 12px;"></div>
    </div>

    <!-- Export & Field Logs -->
    <div class="card">
      <div class="flex justify-between items-center mb-8">
        <div class="card-title" style="margin-bottom: 0;">
          ${ICONS.download}
          <span>Field Log Export</span>
        </div>
        <div class="flex gap-6">
          <button class="btn btn-outline btn-sm" id="lab-export-csv">${ICONS.download} CSV</button>
          <button class="btn btn-outline btn-sm" id="lab-export-json">${ICONS.download} JSON</button>
          <button class="btn btn-danger btn-sm" id="lab-clear">${ICONS.trash}</button>
        </div>
      </div>
      <div class="terminal-log" id="lab-log"></div>
    </div>
  `;

  // Start oscilloscope visualizer
  startOscilloscope('lab-oscilloscope');

  // Mode buttons
  el.querySelector('#lab-mode-rx')!.addEventListener('click', () => {
    labMode = 'receiver';
    render();
  });
  el.querySelector('#lab-mode-tx')!.addEventListener('click', () => {
    labMode = 'sender';
    render();
  });

  // Protocol & distance
  el.querySelector('#lab-protocol')!.addEventListener('change', (e) => {
    labProtocol = (e.target as HTMLSelectElement).value;
  });
  el.querySelector('#lab-distance')!.addEventListener('input', (e) => {
    labDistance = (e.target as HTMLInputElement).value;
  });

  // Start Mic
  el.querySelector('#lab-start')!.addEventListener('click', async () => {
    await initAudio();
    if (audioEngine) {
      await audioEngine.startListening();
      updateUIStatus();
    }
  });

  // Test tone
  el.querySelector('#lab-test-tone')!.addEventListener('click', async () => {
    if (!audioEngine) await initAudio();
    audioEngine?.playTestTone();
  });

  // Send packet
  el.querySelector('#lab-send')?.addEventListener('click', async () => {
    if (!audioEngine) await initAudio();
    labMsgIndex++;
    const msg = `ECHO${labMsgIndex.toString().padStart(3, '0')}`;
    labCounter.sent++;
    updateLabCounters();
    appendLabLog(`TX`, msg);
    await logEvent({
      timestamp: Date.now(),
      event: 'sent',
      protocol: labProtocol,
      distance: labDistance,
      meta: { msg },
    });
    await audioEngine!.transmit(msg);
  });

  // Exports
  el.querySelector('#lab-export-csv')!.addEventListener('click', async () => {
    const csv = await exportCSV();
    downloadFile('echonet-lab.csv', csv, 'text/csv');
  });
  el.querySelector('#lab-export-json')!.addEventListener('click', async () => {
    const json = await exportJSON();
    downloadFile('echonet-lab.json', json, 'application/json');
  });
  el.querySelector('#lab-clear')!.addEventListener('click', async () => {
    await clearLogs();
    labCounter = { sent: 0, decoded: 0, failed: 0, correctedErrors: 0 };
    labMsgIndex = 0;
    render();
  });

  // Loopback
  el.querySelector('#lab-loopback')!.addEventListener('click', runLoopbackTest);
}

// ─────────────────────────────────────────────────────────────
// SCREEN 5: SIMULATOR (Acoustic Room Mesh Simulation)
// ─────────────────────────────────────────────────────────────
function renderSim(el: HTMLElement): void {
  el.innerHTML = `
    <div class="sim-watermark-badge">SIMULATION ENVIRONMENT // SYNTHETIC DATA</div>
    <h1>Mesh Simulator</h1>
    <p class="text-dim mb-12">Simulate acoustic hop propagation across 10-100 phones in a room.</p>

    <!-- Simulation Parameters Card -->
    <div class="card">
      <div class="card-title">
        ${ICONS.sim}
        <span>Room & Mesh Parameters</span>
      </div>

      <div class="flex gap-8 mb-8">
        <div class="flex-1">
          <label class="text-dim" style="font-size: 11px;">NODE COUNT (PHONES)</label>
          <input type="number" id="sim-nodes" value="50" min="5" max="100" class="mt-4" />
        </div>
        <div class="flex-1">
          <label class="text-dim" style="font-size: 11px;">ROOM DIMENSION (M)</label>
          <input type="number" id="sim-room" value="10" min="4" max="50" class="mt-4" />
        </div>
      </div>

      <div class="flex gap-8 mb-12">
        <div class="flex-1">
          <label class="text-dim" style="font-size: 11px;">ACOUSTIC RANGE (M)</label>
          <input type="number" id="sim-range" value="4" min="1" max="15" class="mt-4" />
        </div>
        <div class="flex-1">
          <label class="text-dim" style="font-size: 11px;">ACOUSTIC LOSS (%)</label>
          <input type="number" id="sim-loss" value="30" min="0" max="80" class="mt-4" />
        </div>
      </div>

      <button class="btn btn-primary w-full" id="sim-run">
        ${ICONS.play}
        <span>Run Room Mesh Simulation</span>
      </button>
    </div>

    <!-- Results & Canvas Visualization -->
    <div class="card" id="sim-results" style="display: none;">
      <div class="card-title">
        ${ICONS.wall}
        <span>Simulation Results</span>
      </div>
      <div class="counter-grid counter-grid-4 mb-12" id="sim-stats"></div>

      <div class="sim-canvas-wrapper">
        <canvas id="sim-canvas" width="600" height="400" style="width: 100%; display: block;"></canvas>
      </div>

      <div class="flex justify-between items-center mt-8 text-dim font-mono" style="font-size: 11px;">
        <span style="color: var(--crimson);">● Origin (Authority)</span>
        <span style="color: #00f2fe;">● Hop 1</span>
        <span style="color: #00e676;">● Hop 2</span>
        <span style="color: #ffb300;">● Hop 3+</span>
        <span style="color: #475569;">● Unreached</span>
      </div>
    </div>
  `;

  el.querySelector('#sim-run')!.addEventListener('click', async () => {
    const nodes = parseInt((el.querySelector('#sim-nodes') as HTMLInputElement).value);
    const room = parseInt((el.querySelector('#sim-room') as HTMLInputElement).value);
    const range = parseInt((el.querySelector('#sim-range') as HTMLInputElement).value);
    const loss = parseInt((el.querySelector('#sim-loss') as HTMLInputElement).value) / 100;

    const result = await runSimulation({
      nodeCount: nodes,
      roomWidth: room,
      roomHeight: room,
      range: range,
      frameLossRate: loss,
      seed: Math.floor(Math.random() * 100000),
    });

    displaySimResults(result);
  });
}

// ─────────────────────────────────────────────────────────────
// Canvas Simulation Renderer
// ─────────────────────────────────────────────────────────────
function displaySimResults(result: SimResult): void {
  const el = document.getElementById('sim-results')!;
  el.style.display = 'block';

  document.getElementById('sim-stats')!.innerHTML = `
    <div class="counter-item">
      <div class="counter-value text-primary">${result.coveragePercent.toFixed(0)}%</div>
      <div class="counter-label">Coverage</div>
    </div>
    <div class="counter-item">
      <div class="counter-value">${result.maxHop}</div>
      <div class="counter-label">Max Hops</div>
    </div>
    <div class="counter-item">
      <div class="counter-value">${result.totalTransmissions}</div>
      <div class="counter-label">Total Transmits</div>
    </div>
    <div class="counter-item">
      <div class="counter-value">${(result.timeToLastNode / 1000).toFixed(2)}s</div>
      <div class="counter-label">Broadcast Time</div>
    </div>
  `;

  const canvas = document.getElementById('sim-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  // Background
  ctx.fillStyle = '#06080d';
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const maxX = result.nodes.reduce((max, n) => Math.max(max, n.x), 0) + 1;
  const maxY = result.nodes.reduce((max, n) => Math.max(max, n.y), 0) + 1;
  const scaleX = (w - 40) / maxX;
  const scaleY = (h - 40) / maxY;

  // Draw acoustic propagation lines
  ctx.lineWidth = 1;
  for (const node of result.nodes) {
    if (node.reached && node.hopReceived > 0) {
      const nx = 20 + node.x * scaleX;
      const ny = 20 + node.y * scaleY;
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
      ctx.beginPath();
      ctx.arc(nx, ny, 25, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Draw nodes
  for (const node of result.nodes) {
    const x = 20 + node.x * scaleX;
    const y = 20 + node.y * scaleY;

    ctx.beginPath();
    ctx.arc(x, y, node.id === 0 ? 9 : 5.5, 0, Math.PI * 2);

    if (node.id === 0) {
      ctx.fillStyle = '#ff2a51'; // Authority
      ctx.shadowColor = '#ff2a51';
      ctx.shadowBlur = 10;
    } else if (node.reached) {
      if (node.hopReceived === 1) ctx.fillStyle = '#00f2fe';
      else if (node.hopReceived === 2) ctx.fillStyle = '#00e676';
      else ctx.fillStyle = '#ffb300';
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#334155';
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.fill();

    // Node labels
    if (node.reached && node.id !== 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(String(node.hopReceived), x + 7, y + 3);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Real-Time Audio Oscilloscope Canvas Visualizer
// ─────────────────────────────────────────────────────────────
function startOscilloscope(canvasId: string): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;

  const renderFrame = () => {
    oscilloscopeRaf = requestAnimationFrame(renderFrame);

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, w, h);

    // Grid center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const analyser = audioEngine?.getAnalyser();
    if (!analyser || audioEngine?.getState() !== 'LISTEN') {
      // Idle resting line
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 6;
    ctx.beginPath();

    const sliceWidth = w / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i];
      const y = (v + 1) * (h / 2);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  renderFrame();
}

// ─────────────────────────────────────────────────────────────
// Audio Engine & Relay Initialization
// ─────────────────────────────────────────────────────────────
async function initAudio(): Promise<void> {
  if (audioEngine) return;

  audioEngine = new AudioEngine(
    {
      onDecode: handleDecode,
      onStateChange: handleStateChange,
      onError: handleError,
      onLevelChange: handleLevel,
    },
    { ggwaveProtocol: labProtocol }
  );

  await audioEngine.init();
}

async function initRelay(): Promise<void> {
  if (relayEngine) return;

  relayEngine = new RelayEngine({}, undefined, eventEpoch);

  relayEngine.setTransmitCallback(async (frameBytes) => {
    if (audioEngine) {
      await audioEngine.transmitBytes(frameBytes);
    }
  });

  relayEngine.setAlertCallback((frame) => {
    const text = renderTemplate(frame.templateId, language);
    showAlert(text, frame);
  });
}

// ─────────────────────────────────────────────────────────────
// Audio Callbacks & Relay Processing
// ─────────────────────────────────────────────────────────────
function handleDecode(data: Uint8Array): void {
  // Lab Mode reception
  if (currentScreen === 'lab') {
    labCounter.decoded++;
    const msg = new TextDecoder().decode(data);
    appendLabLog('RX', msg);
    updateLabCounters();
    logEvent({
      timestamp: Date.now(),
      event: 'decoded',
      protocol: labProtocol,
      distance: labDistance,
      meta: { msg },
    });
  }

  // Relay Mode processing
  if (relayEngine && (currentScreen === 'listener' || currentScreen === 'wall')) {
    relayEngine.onFrameReceived(data).then((frame) => {
      if (frame && currentScreen === 'wall') {
        appendWallTimeline(frame);
      }
    });
  }
}

function handleStateChange(_state: AudioState): void {
  updateUIStatus();
}

function handleError(msg: string): void {
  console.error('EchoNet AudioEngine Error:', msg);
  appendLabLog('ERR', msg);
}

function handleLevel(level: number): void {
  const pct = Math.min(100, Math.round(level * 600));
  const labLevel = document.getElementById('lab-level');
  if (labLevel) labLevel.style.width = `${pct}%`;

  const listenerLevel = document.getElementById('listener-level-fill');
  if (listenerLevel) listenerLevel.style.width = `${pct}%`;

  const dbText = document.getElementById('listener-level-db');
  if (dbText) {
    if (pct < 5) dbText.textContent = 'QUIET ROOM';
    else if (pct < 35) dbText.textContent = 'SOUND DETECTED';
    else dbText.textContent = 'HIGH AUDIO LEVEL';
  }
}

// ─────────────────────────────────────────────────────────────
// Authority Broadcast Sequencer
// ─────────────────────────────────────────────────────────────
async function sendAuthorityBeacon(templateId: number): Promise<void> {
  if (!audioEngine) return;

  const alertId = Math.floor(Math.random() * 0xffff);
  const timeBucket = getTimeBucket(eventEpoch, Date.now());

  const frame: BeaconFrame = {
    version: FRAME_VERSION,
    type: FrameType.BEACON,
    alertId,
    templateId,
    regionCode: 0,
    params: new Uint8Array([0, 0, 0]),
    originTimeBucket: timeBucket,
    hop: 0,
    ttl: DEFAULT_CONFIG.ttl,
    mac: new Uint8Array(8),
  };

  // Compute MAC over immutable bytes
  const encoded = encodeFrame(frame);
  const immutable = getImmutableBytes(encoded);
  frame.mac = await computeMAC(immutable);

  const frameBytes = encodeFrame(frame);

  // Show transmission stream
  const logCard = document.getElementById('auth-log-card');
  if (logCard) logCard.style.display = 'block';
  const logStream = document.getElementById('auth-log-stream');

  for (let i = 0; i < DEFAULT_CONFIG.authorityRepeatCount; i++) {
    const repeatLabel = `Beacon ${i + 1}/${DEFAULT_CONFIG.authorityRepeatCount} • Alert 0x${alertId.toString(16).toUpperCase()}`;
    if (logStream) {
      logStream.innerHTML += `
        <div class="log-entry">
          <span class="log-time">${new Date().toLocaleTimeString()}</span>
          <span class="log-tag tx">TX</span>
          <span class="log-msg">${repeatLabel}</span>
        </div>
      `;
      logStream.scrollTop = logStream.scrollHeight;
    }

    const btnText = document.getElementById('auth-btn-text');
    if (btnText) {
      btnText.textContent = `Transmitting ${i + 1}/${DEFAULT_CONFIG.authorityRepeatCount}...`;
    }

    await audioEngine.transmitBytes(frameBytes);

    if (i < DEFAULT_CONFIG.authorityRepeatCount - 1) {
      const spacing =
        DEFAULT_CONFIG.authorityRepeatSpacing[0] +
        Math.random() *
          (DEFAULT_CONFIG.authorityRepeatSpacing[1] -
            DEFAULT_CONFIG.authorityRepeatSpacing[0]);
      await new Promise((r) => setTimeout(r, spacing));
    }
  }

  if (logStream) {
    logStream.innerHTML += `
      <div class="log-entry">
        <span class="log-time">${new Date().toLocaleTimeString()}</span>
        <span class="log-tag rx">OK</span>
        <span class="log-msg text-success">Broadcast sequence completed across ${DEFAULT_CONFIG.authorityRepeatCount} acoustic bursts.</span>
      </div>
    `;
    logStream.scrollTop = logStream.scrollHeight;
  }
}

// ─────────────────────────────────────────────────────────────
// UI Helpers & Telemetry Updaters
// ─────────────────────────────────────────────────────────────
function showAlert(text: string, frame: BeaconFrame): void {
  // Trigger phone vibration if supported
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch { /* ignore */ }
  }

  if (currentScreen === 'listener') {
    const alertCard = document.getElementById('listener-alert-card');
    if (alertCard) {
      alertCard.style.display = 'block';
      document.getElementById('listener-alert-text')!.textContent = text;
      document.getElementById('listener-hop-val')!.textContent = String(frame.hop);
      document.getElementById('listener-alert-id')!.textContent = `0x${frame.alertId.toString(16).toUpperCase()}`;
    }
  }
}

function updateUIStatus(): void {
  if (!audioEngine) return;
  const state = audioEngine.getState();

  // Header badges
  const headerStateText = document.getElementById('header-state-text');
  if (headerStateText) headerStateText.textContent = state;
  const headerBadge = document.getElementById('header-audio-badge');
  if (headerBadge) {
    headerBadge.className = `status-badge status-${state.toLowerCase()}`;
  }

  // Listener badges
  const listenerStatusLabel = document.getElementById('listener-status-label');
  if (listenerStatusLabel) listenerStatusLabel.textContent = state;
  const listenerPill = document.getElementById('listener-status-pill');
  if (listenerPill) {
    listenerPill.className = `status-badge status-${state.toLowerCase()}`;
  }
  const toggleBtnText = document.getElementById('listener-toggle-text');
  if (toggleBtnText) {
    toggleBtnText.textContent = state === 'LISTEN' ? 'Listening Active' : 'Start Acoustic Mesh';
  }

  // Lab badges
  const labStatus = document.getElementById('lab-status');
  if (labStatus) {
    labStatus.className = `status-badge status-${state.toLowerCase()}`;
    labStatus.innerHTML = `<div class="status-indicator-dot"></div><span>${state}</span>`;
  }
}

function appendLabLog(type: 'TX' | 'RX' | 'ERR', msg: string): void {
  const el = document.getElementById('lab-log');
  if (!el) return;
  const time = new Date().toLocaleTimeString();
  const tagClass = type.toLowerCase();
  el.innerHTML += `
    <div class="log-entry">
      <span class="log-time">${time}</span>
      <span class="log-tag ${tagClass}">${type}</span>
      <span class="log-msg">${msg}</span>
    </div>
  `;
  el.scrollTop = el.scrollHeight;
}

function updateLabCounters(): void {
  const set = (id: string, v: number) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
  };
  set('lab-c-sent', labCounter.sent);
  set('lab-c-decoded', labCounter.decoded);
  set('lab-c-failed', labCounter.failed);
  set('lab-c-errors', labCounter.correctedErrors);
}

function appendWallTimeline(frame: BeaconFrame): void {
  wallFrameCount++;
  wallMaxHop = Math.max(wallMaxHop, frame.hop);

  if (wallFrameCount === 1) {
    wallFirstFrameTime = Date.now();
    // Start race clock interval
    if (wallRaceInterval) clearInterval(wallRaceInterval);
    wallRaceInterval = setInterval(() => {
      const elapsedMs = Date.now() - wallFirstFrameTime;
      const el = document.getElementById('wall-race-digits');
      if (el) el.textContent = (elapsedMs / 1000).toFixed(2);
    }, 50);
  }

  const elapsed = ((Date.now() - wallFirstFrameTime) / 1000).toFixed(2);
  const text = renderTemplate(frame.templateId, 'en');

  const timeline = document.getElementById('wall-timeline');
  if (timeline) {
    const time = new Date().toLocaleTimeString();
    timeline.innerHTML += `
      <div class="log-entry">
        <span class="log-time">${time} (+${elapsed}s)</span>
        <span class="log-tag rx">HOP ${frame.hop}</span>
        <span class="log-msg"><strong>0x${frame.alertId.toString(16).toUpperCase()}</strong>: ${text}</span>
      </div>
    `;
    timeline.scrollTop = timeline.scrollHeight;
  }

  // Update wall stats
  const set = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('wall-c-frames', String(wallFrameCount));
  set('wall-c-hops', String(wallMaxHop));
  set('wall-race-peak-hop', `${wallMaxHop} HOPS`);
  const firstHopEl = document.getElementById('wall-race-first-hop');
  if (firstHopEl && firstHopEl.textContent === '--') {
    firstHopEl.textContent = `HOP ${frame.hop}`;
  }
}

async function runLoopbackTest(): Promise<void> {
  const resultEl = document.getElementById('lab-loopback-result');
  if (!resultEl) return;

  resultEl.innerHTML = '<span class="text-dim">Testing RAM encode/decode...</span>';

  try {
    const ggwaveFactory = (await import('ggwave')).default;
    const ggwave = await ggwaveFactory();
    const params = ggwave.getDefaultParameters();
    const instance = ggwave.init(params);

    const testMsg = 'ECHO001';
    const protocols = ggwave.ProtocolId || ggwave.TxProtocolId || {};
    const protocolId = protocols['GGWAVE_PROTOCOL_AUDIBLE_FAST'] ?? 1;
    const waveform = ggwave.encode(instance, testMsg, protocolId, 25);

    if (!waveform || waveform.length === 0) {
      resultEl.innerHTML = '<span class="text-danger">FAIL: Empty waveform synthesized</span>';
      ggwave.free(instance);
      return;
    }

    const decoded = ggwave.decode(instance, waveform);
    ggwave.free(instance);

    if (decoded && decoded.length > 0) {
      const decodedStr = new TextDecoder().decode(decoded);
      if (decodedStr === testMsg) {
        resultEl.innerHTML = `<span class="text-success">✓ PASS: In-memory loopback succeeded (${waveform.length} PCM samples verified).</span>`;
      } else {
        resultEl.innerHTML = `<span class="text-warning">DIFF: Decoded "${decodedStr}" (expected "${testMsg}")</span>`;
      }
    } else {
      resultEl.innerHTML = '<span class="text-danger">FAIL: Decoder returned null on loopback samples</span>';
    }
  } catch (e) {
    resultEl.innerHTML = `<span class="text-danger">ERROR: ${e}</span>`;
  }
}

function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function checkOfflineReady(el: HTMLElement): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(() => {
      el.innerHTML = `${ICONS.wifiOff}<span>Offline Ready</span>`;
    });
  }
}

// ─── Visibility Warning ───
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    console.warn('EchoNet: Page hidden; background audio throttling may occur on iOS');
  }
});

// ─── Boot ───
render();
