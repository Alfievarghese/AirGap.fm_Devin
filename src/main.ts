/**
 * AirGap.fm main entry point.
 * Wires screens: Listener, Authority, Wall, Lab, Sim.
 * Impeccable Neo-Kinpaku System & UI-UX-Pro-Max Design Standards.
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
import {
  renderTemplate,
  TEMPLATES,
  Language,
  MODULAR_SUBJECTS,
  MODULAR_ACTIONS,
  MODULAR_LOCATIONS,
  renderModularAlert,
} from './protocol/templates';
import {
  encodeIndicString,
  decodeIndicString,
  detectScript,
  getScriptLabel,
  ScriptId,
} from './protocol/indicCodec';
import {
  translateCustomText,
  transliterateISCII,
} from './protocol/offlineTranslator';
import {
  getLocalNodeId,
  setLocalNodeId,
  formatNodeId,
  toHexId,
  parseNodeId,
  NODE_ID_BROADCAST,
  NODE_ID_WALL,
} from './protocol/nodeId';
import {
  renderTargetSelector,
  bindTargetSelectorEvents,
  resolveTargetNodeId,
  TargetType,
} from './ui/authority';
import { logEvent, exportCSV, exportJSON, clearLogs } from './store/log';
import { DEFAULT_CONFIG } from './lib/config';
import { runSimulation, SimResult } from './relay/sim';
import { ICONS } from './ui/icons';
import { spectrogram } from './ui/spectrogram';
import { globalAcousticMesh3D } from './ui/mesh3d';
import { init3DCardTilt } from './ui/tilt3d';

// ─── Application State ───
type Screen = 'listener' | 'authority' | 'wall' | 'lab' | 'sim';
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
let authActiveTab: 'instant' | 'custom' = 'instant';
let selectedTemplateId = 0x01;
let customPagerText = '';
let modularSubjectId = 0;
let modularActionId = 0;
let modularLocationId = 0;
let useModularSentence = false;

// Node Identity & Targeted Unicast State
let myNodeId = getLocalNodeId();
let authTargetType: TargetType = 'broadcast';
let authUnicastHex: string = 'A4';

// Wall State
let wallFrameCount = 0;
let wallMaxHop = 0;
let wallFirstFrameTime = 0;
let wallRaceInterval: ReturnType<typeof setInterval> | null = null;

// Visualizer State (Waterfall, Scope, 3D Mesh Hologram)
let listenerVisualMode: 'waterfall' | 'oscilloscope' | 'mesh3d' = 'waterfall';
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

// ─── Screen Flash Strobe Trigger ───
export function triggerScreenFlash(
  color: 'emerald' | 'amber' | 'crimson' | 'cyan',
  title: string,
  subtitle: string
): void {
  const strobe = document.getElementById('screen-strobe');
  if (!strobe) return;

  strobe.innerHTML = `
    <div class="strobe-hud-title">${title}</div>
    <div class="strobe-hud-sub">${subtitle}</div>
  `;

  strobe.className = `screen-strobe-overlay strobe-${color} active-strobe`;

  setTimeout(() => {
    strobe.className = 'screen-strobe-overlay';
    strobe.innerHTML = '';
  }, 600);
}

// ─── Root Render ───
function render(): void {
  const app = document.getElementById('app')!;

  if (currentScreen === 'wall') {
    app.classList.add('wall-mode');
  } else {
    app.classList.remove('wall-mode');
  }

  spectrogram.stop();
  globalAcousticMesh3D.stop();
  if (oscilloscopeRaf) {
    cancelAnimationFrame(oscilloscopeRaf);
    oscilloscopeRaf = null;
  }

  if (isInAppBrowser()) {
    app.innerHTML = `
      <div class="drill-banner">
        <div class="drill-banner-inner">
          ${ICONS.alertTriangle}
          <span>DRILL PROTOCOL ACTIVE // EXPERIMENTAL ACOUSTIC MESH</span>
        </div>
      </div>
      <div class="card" style="margin-top: 40px; text-align: center;">
        <div style="color: var(--vermilion-alert); margin-bottom: 12px;">${ICONS.alertTriangle}</div>
        <h1 style="color: var(--vermilion-alert);">Open in Native Browser</h1>
        <p class="mt-8">AirGap.fm requires microphone and Web Audio access. In app webviews block audio streams.</p>
        <p class="mt-12 text-muted font-mono">Copy URL and open in Chrome or Safari.</p>
      </div>
    `;
    return;
  }

  const currentState = audioEngine ? audioEngine.getState() : 'IDLE';

  let html = `
    <!-- Tactical Transceiver Header -->
    <header class="app-header">
      <div class="brand-badge">
        <div class="brand-logo-mark">
          ${ICONS.airgapLogo}
        </div>
        <div>
          <div class="brand-title">
            AirGap<span class="brand-tld">.fm</span>
            <span class="brand-channel-tag">CH-01 · 1.8-6.3 kHz</span>
          </div>
          <div class="brand-sub">Offline Acoustic Mesh Transceiver</div>
        </div>
      </div>
      <div class="header-meta">
        <button id="header-node-id-btn" class="node-id-pill" title="Tap to change Node ID for stage demo">
          <span class="node-id-hash">#</span><span id="header-node-id-val">${toHexId(myNodeId)}</span>
        </button>
        <div id="header-offline-pill" class="offline-pill">
          <div class="live-beacon-dot"></div>
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

    <!-- Fullscreen Strobe Wave Overlay -->
    <div id="screen-strobe" class="screen-strobe-overlay"></div>

    <!-- Floating Tactical Navigation Dock -->
    <div class="nav-dock-container">
      <nav class="nav-bar">
        <button class="nav-tab ${currentScreen === 'listener' ? 'active' : ''}" data-screen="listener">
          ${ICONS.listener}
          <span>Receiver (RX)</span>
        </button>
        <button class="nav-tab ${currentScreen === 'authority' ? 'active' : ''}" data-screen="authority">
          ${ICONS.authority}
          <span>Sender (TX)</span>
        </button>
        <button class="nav-tab ${currentScreen === 'wall' ? 'active' : ''}" data-screen="wall">
          ${ICONS.wall}
          <span>The Wall</span>
        </button>
      </nav>
    </div>
  `;

  app.innerHTML = html;

  const nodeIdBtn = document.getElementById('header-node-id-btn');
  if (nodeIdBtn) {
    nodeIdBtn.addEventListener('click', () => {
      const currentHex = toHexId(myNodeId);
      const input = window.prompt(
        'Set Device Node ID (01 to FE in Hex, e.g. A4):\n(00 = Broadcast, FF = Projector Wall)',
        currentHex
      );
      if (input !== null) {
        const parsed = parseNodeId(input);
        if (parsed !== null && parsed >= 0x01 && parsed <= 0xfe) {
          setLocalNodeId(parsed);
          myNodeId = parsed;
          if (relayEngine) {
            relayEngine.setMyNodeId(myNodeId);
          }
          const valEl = document.getElementById('header-node-id-val');
          if (valEl) valEl.textContent = toHexId(myNodeId);
          triggerScreenFlash('cyan', `NODE IDENTITY: #${toHexId(myNodeId)}`, 'DEVICE ADDRESS UPDATED');
        } else {
          alert('Invalid ID! Please enter a 2-character hex between 01 and FE (e.g. 7F, A4, B2).');
        }
      }
    });
  }

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

  checkOfflineReady(document.getElementById('header-offline-pill')!);
  init3DCardTilt();
}

// ─────────────────────────────────────────────────────────────
// SCREEN 1: LISTENER (Citizen Acoustic Node)
// ─────────────────────────────────────────────────────────────
function renderListener(el: HTMLElement): void {
  const currentState = audioEngine ? audioEngine.getState() : 'IDLE';

  el.innerHTML = `
    <div class="flex justify-between items-center mb-16">
      <div>
        <h1 style="font-family: var(--font-display); font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">Acoustic Transceiver Node</h1>
        <p class="text-secondary" style="font-size: 13px; margin-top: 2px;">Relays emergency beacons across phones using sound waves.</p>
      </div>
      <div>
        <select id="listener-lang" style="width: auto; padding: 7px 14px; font-size: 12px; font-weight: 600; background: #ffffff; border: 1.5px solid var(--border-card); border-radius: var(--radius-sm); color: var(--text-primary); cursor: pointer;">
          <option value="en" ${language === 'en' ? 'selected' : ''}>English (EN)</option>
          <option value="ml" ${language === 'ml' ? 'selected' : ''}>മലയാളം (ML)</option>
          <option value="hi" ${language === 'hi' ? 'selected' : ''}>हिन्दी (HI)</option>
        </select>
      </div>
    </div>

    <!-- Intermediate Silent Routing Banner (Visible when silently forwarding packet to another device) -->
    <div id="listener-routing-banner" class="routing-banner" style="display: none;">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-8">
          <span style="color: var(--color-amber);">${ICONS.broadcast}</span>
          <strong id="routing-banner-title" style="color: var(--color-amber); font-family: var(--font-mono); font-size: 13px;">
            ROUTING PACKET TO #A4 • HOP 1
          </strong>
        </div>
        <span class="chip chip-sm" style="background: var(--color-amber-subtle); color: var(--color-amber); border: 1px solid var(--color-amber-border); font-weight: 700;">
          SILENT FORWARD
        </span>
      </div>
      <p id="routing-banner-desc" style="font-size: 12px; color: var(--text-secondary); margin: 0;">
        Message payload masked for target device privacy. Trickle gossip relay scheduled to forward acoustic burst across mesh.
      </p>
    </div>

    <!-- Active Emergency Banner (Hidden until alert heard) -->
    <div id="listener-alert-card" class="alert-card-hero" style="display: none;">
      <div class="flex items-center justify-between mb-8">
        <div class="alert-badge-top" style="margin-bottom: 0;">
          ${ICONS.alertTriangle}
          <span id="listener-card-type-label">ACOUSTIC BEACON RECEIVED</span>
        </div>
        <div id="listener-direct-badge" style="display: none;">
          <span class="chip font-mono" style="background: rgba(6, 182, 212, 0.15); color: #0891b2; border: 1.5px solid #06b6d4; font-weight: 800; padding: 4px 10px;">
            [DIRECT MESSAGE TO #${toHexId(myNodeId)}]
          </span>
        </div>
      </div>
      <h2 id="listener-alert-text">EMERGENCY ALERT</h2>
      <div class="alert-meta-grid">
        <div class="alert-meta-item">
          <div class="alert-meta-label">Hop Level</div>
          <div class="alert-meta-val" id="listener-hop-val">0</div>
        </div>
        <div class="alert-meta-item">
          <div class="alert-meta-label">Routing Target</div>
          <div class="alert-meta-val" id="listener-target-val" style="color: var(--color-marine);">BROADCAST</div>
        </div>
        <div class="alert-meta-item">
          <div class="alert-meta-label">Alert ID</div>
          <div class="alert-meta-val" id="listener-alert-id">0x0000</div>
        </div>
        <div class="alert-meta-item">
          <div class="alert-meta-label">Security MAC</div>
          <div class="alert-meta-val" style="color: #6ee7b7;">32 BIT VERIFIED</div>
        </div>
      </div>
    </div>

    <div class="cockpit-grid">
      <!-- Left Column: Transceiver Core & Optical Instruments -->
      <div>
        <div class="card">
          <div class="card-header-bar">
            <div class="card-title">
              ${ICONS.radioWave}
              <span>Acoustic Visualizer</span>
            </div>
            <div class="hardware-segmented-control">
              <button class="hardware-segment-btn ${listenerVisualMode === 'mesh3d' ? 'active' : ''}" id="mode-mesh3d">3D Hologram</button>
              <button class="hardware-segment-btn ${listenerVisualMode === 'waterfall' ? 'active' : ''}" id="mode-waterfall">Waterfall</button>
              <button class="hardware-segment-btn ${listenerVisualMode === 'oscilloscope' ? 'active' : ''}" id="mode-scope">Scope</button>
            </div>
          </div>

          <!-- Optical Instrument Screen Housing -->
          <div class="instrument-housing">
            <div class="mesh3d-container" id="listener-mesh3d-box" style="${listenerVisualMode === 'mesh3d' ? '' : 'display:none'}">
              <canvas id="listener-mesh3d-canvas" class="mesh3d-canvas" width="600" height="240"></canvas>
            </div>
            <canvas id="listener-waterfall-canvas" class="waterfall-canvas" width="600" height="160" style="${listenerVisualMode === 'waterfall' ? '' : 'display:none'}"></canvas>
            <canvas id="listener-scope-canvas" class="oscilloscope-canvas" width="600" height="100" style="${listenerVisualMode === 'oscilloscope' ? '' : 'display:none'}"></canvas>

            <div class="instrument-scale-bar">
              <span>1.8 kHz FSK BASE</span>
              <span>3.5 kHz</span>
              <span>5.0 kHz</span>
              <span>6.3 kHz FSK PEAK</span>
            </div>
          </div>

          <!-- Calibrated Decibel VU Meter -->
          <div class="vu-meter-housing">
            <div class="vu-meter-top">
              <span>ACOUSTIC SPECTRUM INPUT ENERGY</span>
              <span id="listener-level-db" class="vu-meter-db-readout">-60 dB · QUIET</span>
            </div>
            <div class="vu-meter-track">
              <div class="vu-meter-bar" id="listener-level-fill"></div>
            </div>
            <div class="vu-scale-ticks">
              <span>-48 dB</span>
              <span>-24 dB</span>
              <span>-12 dB</span>
              <span>-6 dB</span>
              <span>0 dB PEAK</span>
            </div>
          </div>

          <!-- Hardware Action Controls -->
          <div class="flex flex-col gap-10 mt-16">
            <button class="btn-transceiver-primary" id="listener-toggle-btn">
              ${ICONS.mic}
              <span id="listener-toggle-text">${currentState === 'LISTEN' ? 'Listening Active · Armed for Chirps' : 'Start Acoustic Listener'}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Column: 14-Byte Frame Anatomy & Offline Procedure -->
      <div>
        <!-- 14-Byte Acoustic Frame Anatomy Strip -->
        <div class="frame-anatomy-card">
          <div class="flex justify-between items-center">
            <div class="card-title" style="margin-bottom: 0;">
              ${ICONS.shieldCheck}
              <span>14-Byte Acoustic Frame Anatomy</span>
            </div>
            <span class="brand-channel-tag">GGWAVE FSK</span>
          </div>
          <p class="text-secondary mt-8" style="font-size: 12px; line-height: 1.5;">
            How AirGap.fm packs an authenticated alert into 14 bytes to propagate across rooms in ~1.2s:
          </p>

          <div class="frame-strip">
            <div class="frame-segment frame-segment-magic" data-desc="Header (1 Byte): Version (2b), FrameType (2b: Template 0 / Custom Pager 1), ScriptId (4b: ASCII / Malayalam / Hindi).">
              <span class="frame-segment-byte">1B</span>
              <span class="frame-segment-label">Header</span>
            </div>
            <div class="frame-segment frame-segment-type" data-desc="Target Node ID (1 Byte): 0x00 = Room Broadcast, 0xFF = Projector Wall Sink, 0x01..0xFE = Direct Unicast.">
              <span class="frame-segment-byte">1B</span>
              <span class="frame-segment-label">Target</span>
            </div>
            <div class="frame-segment frame-segment-time" data-desc="Alert ID (2 Bytes): Unique uint16 identifier for deduplication across the acoustic mesh.">
              <span class="frame-segment-byte">2B</span>
              <span class="frame-segment-label">Alert ID</span>
            </div>
            <div class="frame-segment frame-segment-data" data-desc="Payload (5 Bytes): Template ID + Region Code + Modular params (Subject, Action, Location) OR 5 bytes of 1-byte compressed Indic/ASCII text.">
              <span class="frame-segment-byte">5B</span>
              <span class="frame-segment-label">Payload</span>
            </div>
            <div class="frame-segment frame-segment-hop" data-desc="Hop & TTL (1 Byte): High nibble = hop count, low nibble = TTL. Mutable field excluded from MAC.">
              <span class="frame-segment-byte">1B</span>
              <span class="frame-segment-label">Hop|TTL</span>
            </div>
            <div class="frame-segment frame-segment-mac" data-desc="HMAC-SHA256 (4 Bytes): Truncated 32-bit cryptographic tag verifying civil authority origin over immutable bytes [0..8].">
              <span class="frame-segment-byte">4B</span>
              <span class="frame-segment-label">HMAC</span>
            </div>
          </div>

          <div id="frame-detail-text" class="frame-detail-callout">
            <strong>Tap any segment</strong> to inspect byte allocation. Total frame airtime is ~1.2 seconds per acoustic hop.
          </div>
        </div>

        <!-- Physical Radio Field Procedure -->
        <div class="card">
          <div class="card-title mb-12">
            ${ICONS.wifiOff}
            <span>Offline Field Procedure</span>
          </div>
          <div class="field-steps-list">
            <div class="field-step-item">
              <div class="field-step-badge">1</div>
              <div class="field-step-body">
                <h4>Turn Airplane Mode ON</h4>
                <p>Disable Wi-Fi, Bluetooth, and cellular. The Web Audio stack operates completely offline in local browser cache.</p>
              </div>
            </div>
            <div class="field-step-item">
              <div class="field-step-badge">2</div>
              <div class="field-step-body">
                <h4>Acoustic FSK Propagation</h4>
                <p>When an alert triggers, phones emit 6 simultaneous FSK tones across 96 subbands between 1.8 kHz and 6.3 kHz.</p>
              </div>
            </div>
            <div class="field-step-item">
              <div class="field-step-badge">3</div>
              <div class="field-step-body">
                <h4>HMAC Verification & Green Wave</h4>
                <p>Each phone verifies the 32-bit HMAC signature, pulses the screen green, decrements TTL, and relays to the next room.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (listenerVisualMode === 'waterfall') {
    spectrogram.start('listener-waterfall-canvas', audioEngine ? audioEngine.getAnalyser() : null);
  } else if (listenerVisualMode === 'oscilloscope') {
    startOscilloscope('listener-scope-canvas');
  } else {
    globalAcousticMesh3D.start('listener-mesh3d-canvas', audioEngine ? audioEngine.getAnalyser() : null);
  }

  el.querySelector('#mode-waterfall')!.addEventListener('click', () => {
    listenerVisualMode = 'waterfall';
    render();
  });
  el.querySelector('#mode-scope')!.addEventListener('click', () => {
    listenerVisualMode = 'oscilloscope';
    render();
  });
  el.querySelector('#mode-mesh3d')!.addEventListener('click', () => {
    listenerVisualMode = 'mesh3d';
    render();
  });

  // Interactive Frame Segment inspector
  const detailBox = el.querySelector('#frame-detail-text');
  el.querySelectorAll('.frame-segment').forEach((seg) => {
    seg.addEventListener('click', () => {
      const desc = (seg as HTMLElement).dataset.desc;
      if (detailBox && desc) {
        detailBox.innerHTML = `<strong>Inspecting:</strong> ${desc}`;
      }
    });
  });

  el.querySelector('#listener-lang')!.addEventListener('change', (e) => {
    language = (e.target as HTMLSelectElement).value as Language;
  });

  const toggleBtn = el.querySelector('#listener-toggle-btn')!;
  toggleBtn.addEventListener('click', async () => {
    await initAudio();
    await initRelay();
    if (audioEngine) {
      if (audioEngine.getState() === 'IDLE') {
        await audioEngine.startListening();
        if (listenerVisualMode === 'waterfall') {
          spectrogram.start('listener-waterfall-canvas', audioEngine.getAnalyser());
        } else if (listenerVisualMode === 'mesh3d') {
          globalAcousticMesh3D.start('listener-mesh3d-canvas', audioEngine.getAnalyser());
        }
      }
      updateUIStatus();
    }
  });
}


// ─────────────────────────────────────────────────────────────
// SCREEN 2: AUTHORITY (Sender TX / Civil Emergency Broadcast)
// ─────────────────────────────────────────────────────────────
function renderAuthority(el: HTMLElement): void {
  el.innerHTML = `
    <div class="flex justify-between items-center mb-12">
      <div>
        <h1 style="font-family: var(--font-display); font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Sender & Civil Authority (TX)</h1>
        <p class="text-secondary" style="font-size: 13px;">Cryptographically authenticated origin transmitter for emergency acoustic mesh alerts.</p>
      </div>
      <div class="status-badge" style="background: var(--color-primary-subtle); border: 1.5px solid var(--color-primary-border); color: var(--color-primary);">
        ${ICONS.authority}
        <span>EMERGENCY TRANSMITTER</span>
      </div>
    </div>

    <div class="cockpit-grid reverse-mobile">
      <!-- Left Column: Authorization & 3D Key Anchor -->
      <div>
        <!-- Transmitter Status Card -->
        <div class="card">
          <div class="card-title" style="margin-bottom: 0;">
            ${ICONS.authority}
            <span>Transmitter Status</span>
          </div>
          <div class="flex flex-col gap-8 mt-12">
            <div class="flex justify-between items-center p-8" style="background: var(--bg-inset); border-radius: var(--radius-sm); border: 1px solid var(--border-line);">
              <span class="text-xs text-secondary font-bold">MY NODE ADDRESS</span>
              <span class="chip font-mono text-cyan">#${toHexId(myNodeId)}</span>
            </div>
            <div class="flex justify-between items-center p-8" style="background: var(--bg-inset); border-radius: var(--radius-sm); border: 1px solid var(--border-line);">
              <span class="text-xs text-secondary font-bold">CARRIER BAND</span>
              <span class="text-xs font-mono font-bold text-primary">1.8 - 6.3 kHz Audible FSK</span>
            </div>
            <div class="flex justify-between items-center p-8" style="background: var(--bg-inset); border-radius: var(--radius-sm); border: 1px solid var(--border-line);">
              <span class="text-xs text-secondary font-bold">FRAME SPEC</span>
              <span class="text-xs font-mono font-bold text-patina">14 Bytes · ~1.1s Airtime</span>
            </div>
          </div>
        </div>

        <!-- 3D Acoustic Security Hologram -->
        <div class="card">
          <div class="card-title">
            ${ICONS.shieldCheck}
            <span>Cryptographic Mesh Anchor</span>
          </div>
          <div class="mesh3d-container" style="height: 190px;">
            <div class="mesh3d-badge">
              <div class="dot"></div>
              <span>HMAC 32 BIT MESH KEY</span>
            </div>
            <canvas id="auth-mesh3d-canvas" class="mesh3d-canvas" width="540" height="190"></canvas>
            <div class="mesh3d-hint">Interactive 3D Key Anchor</div>
          </div>
          <p class="text-secondary mt-8" style="font-size: 12px; line-height: 1.5;">Only emergency beacons cryptographically authenticated by this authority root will propagate across citizen acoustic relays.</p>
        </div>
      </div>

      <!-- Right Column: Target Destination & Message Composer -->
      <div>
        ${renderTargetSelector(authTargetType, authUnicastHex)}

        <div class="card p-0" style="overflow: hidden;">
          <!-- Dual Subtabs Nav -->
          <div class="auth-tabs-nav">
            <button class="auth-subtab ${authActiveTab === 'instant' ? 'active' : ''}" id="auth-subtab-instant">
              ${ICONS.alertTriangle}
              <span>Instant Multilingual Alert</span>
            </button>
            <button class="auth-subtab ${authActiveTab === 'custom' ? 'active' : ''}" id="auth-subtab-custom">
              ${ICONS.broadcast}
              <span>Custom Pager (EN / ML / HI)</span>
            </button>
          </div>

          <div class="p-16">
            <!-- SUBTAB 1: Instant Multilingual Alert -->
            <div id="auth-tab-instant-content" style="${authActiveTab === 'instant' ? '' : 'display: none;'}">
              <div class="mb-12">
                <label class="text-xs text-secondary font-bold uppercase tracking-wider block mb-6">1-Tap Emergency Template</label>
                <select id="auth-template" class="w-full mb-8">
                  ${TEMPLATES.map(
                    (t) => `
                    <option value="${t.id}" ${selectedTemplateId === t.id ? 'selected' : ''}>
                      [0x${t.id.toString(16).padStart(2, '0').toUpperCase()}] ${t.en}
                    </option>`
                  ).join('')}
                </select>
              </div>

              <!-- Modular 3-Dropdown Sentence Builder -->
              <div class="p-12 mb-12" style="background: var(--bg-inset); border-radius: var(--radius-md); border: 1px solid var(--border-line);">
                <div class="flex justify-between items-center mb-8">
                  <span class="text-xs font-bold text-primary uppercase tracking-wider">Modular Sentence Builder (3 Bytes)</span>
                  <span class="chip chip-sm font-mono">Params: 3B</span>
                </div>
                <div class="grid grid-cols-1 gap-8 mb-8">
                  <div>
                    <label class="text-xs text-secondary block mb-4">1. Subject / Resource</label>
                    <select id="modular-subject" class="w-full text-xs">
                      ${MODULAR_SUBJECTS.map((s) => `<option value="${s.id}" ${modularSubjectId === s.id ? 'selected' : ''}>${s.en} (${s.ml})</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="text-xs text-secondary block mb-4">2. Action / Directive</label>
                    <select id="modular-action" class="w-full text-xs">
                      ${MODULAR_ACTIONS.map((a) => `<option value="${a.id}" ${modularActionId === a.id ? 'selected' : ''}>${a.en} (${a.ml})</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="text-xs text-secondary block mb-4">3. Location / Sector</label>
                    <select id="modular-location" class="w-full text-xs">
                      ${MODULAR_LOCATIONS.map((l) => `<option value="${l.id}" ${modularLocationId === l.id ? 'selected' : ''}>${l.en} (${l.ml})</option>`).join('')}
                    </select>
                  </div>
                </div>
                <label class="flex items-center gap-6 cursor-pointer mt-4" style="font-size: 12px;">
                  <input type="checkbox" id="auth-use-modular" ${useModularSentence ? 'checked' : ''} />
                  <span>Broadcast modular sentence instead of standard template</span>
                </label>
              </div>

              <!-- Live Trilingual Preview -->
              <div id="auth-template-preview" class="p-12 mb-12" style="background: var(--bg-inset); border-radius: var(--radius-md); border: 1px solid var(--border-line); font-size: 13px; line-height: 1.5;">
                <div class="text-faint mb-4" style="font-size: 10px; font-family: var(--font-mono);">PREVIEW (14-BYTE FAST FRAME):</div>
                <div id="preview-en" class="text-pure font-bold"></div>
                <div id="preview-ml" class="text-patina mt-4"></div>
                <div id="preview-hi" class="text-muted mt-4"></div>
              </div>

              <button class="btn btn-danger w-full mt-12" id="auth-broadcast-btn" ${isAuthorityBroadcasting ? 'disabled' : ''}>
                ${ICONS.broadcast}
                <span id="auth-btn-text">
                  ${authTargetType === 'broadcast'
                    ? 'Broadcast Emergency Beacon to Room (14B • 3x repeats)'
                    : authTargetType === 'unicast'
                    ? `Send Direct Beacon to Phone #${authUnicastHex} (14B • 3x repeats)`
                    : 'Send Emergency Beacon to Projector Wall (14B • 3x repeats)'}
                </span>
              </button>
            </div>

            <!-- SUBTAB 2: Custom Pager (EN / ML / HI) -->
            <div id="auth-tab-custom-content" style="${authActiveTab === 'custom' ? '' : 'display: none;'}">
              <div class="flex justify-between items-center mb-6">
                <label class="text-xs text-secondary font-bold uppercase tracking-wider">Emergency Custom Pager Text</label>
                <div id="pager-script-badge" class="badge">ASCII 1-Byte Mode Active</div>
              </div>

              <div class="mb-8">
                <input 
                  type="text" 
                  id="custom-pager-input" 
                  maxlength="8" 
                  placeholder="e.g. സഹായം, വെള്ളം, मदद, FIRE, SOS" 
                  value="${customPagerText}" 
                  style="font-size: 16px; font-family: var(--font-mono); padding: 10px 12px; width: 100%; border-radius: var(--radius-md); border: 1px solid var(--border-line);" 
                />
                <div id="pager-byte-counter" class="text-xs text-right mt-4 font-mono text-secondary">
                  0 / 6 Compressed Bytes (66% airtime saved)
                </div>
              </div>

              <!-- Quick Tokens Chips -->
              <div class="mb-12">
                <div class="text-xs text-secondary mb-6 font-bold">Quick Disaster Emergency Tokens:</div>
                <div class="flex flex-wrap gap-6" id="pager-quick-chips">
                  <button class="chip chip-pager" data-text="സഹായം">സഹായം (Help)</button>
                  <button class="chip chip-pager" data-text="വെള്ളം">വെള്ളം (Water)</button>
                  <button class="chip chip-pager" data-text="തീ">തീ (Fire)</button>
                  <button class="chip chip-pager" data-text="മദദ">मदद (Help)</button>
                  <button class="chip chip-pager" data-text="पानी">पानी (Water)</button>
                  <button class="chip chip-pager" data-text="DOCTOR">DOCTOR</button>
                  <button class="chip chip-pager" data-text="FOOD">FOOD</button>
                  <button class="chip chip-pager" data-text="SOS">SOS</button>
                </div>
              </div>

              <!-- Trilingual Live Preview Card -->
              <div class="p-12 mb-12" style="background: var(--bg-inset); border-radius: var(--radius-md); border: 1px solid var(--border-line); font-size: 13px; line-height: 1.5;">
                <div class="flex justify-between items-center mb-6">
                  <div class="text-faint" style="font-size: 10px; font-family: var(--font-mono);">RECEIVER TRANSLATION PREVIEW (14B FAST FRAME):</div>
                  <span id="pager-orig-badge" class="badge badge-outline" style="font-size: 10px;">[Orig: —]</span>
                </div>
                <div class="grid gap-6">
                  <div class="flex items-center gap-8">
                    <span class="chip" style="font-size: 9px; padding: 2px 5px;">EN</span>
                    <span id="custom-preview-en" class="font-bold text-pure">Waiting for text...</span>
                  </div>
                  <div class="flex items-center gap-8">
                    <span class="chip" style="font-size: 9px; padding: 2px 5px;">ML</span>
                    <span id="custom-preview-ml" class="text-patina">—</span>
                  </div>
                  <div class="flex items-center gap-8">
                    <span class="chip" style="font-size: 9px; padding: 2px 5px;">HI</span>
                    <span id="custom-preview-hi" class="text-muted">—</span>
                  </div>
                </div>
              </div>

              <button class="btn btn-danger w-full mt-12" id="auth-broadcast-custom-btn" ${isAuthorityBroadcasting ? 'disabled' : ''}>
                ${ICONS.broadcast}
                <span id="auth-custom-btn-text">
                  ${authTargetType === 'broadcast'
                    ? 'Broadcast Custom Pager Chirp (14B • ~1.2s airtime)'
                    : authTargetType === 'unicast'
                    ? `Send Direct Chirp to Phone #${authUnicastHex} (14B • ~1.2s airtime)`
                    : 'Send Custom Chirp to Projector Wall (14B • ~1.2s airtime)'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Transmission Terminal Log -->
        <div class="card" id="auth-log-card" style="display: none; margin-top: 16px;">
          <div class="card-title">
            ${ICONS.broadcast}
            <span>Transmission Log</span>
          </div>
          <div class="terminal-card">
            <div class="terminal-header">
              <div class="terminal-dots">
                <div class="terminal-dot red"></div>
                <div class="terminal-dot yellow"></div>
                <div class="terminal-dot green"></div>
              </div>
              <div class="terminal-title">Acoustic Burst Queue</div>
            </div>
            <div class="terminal-log" id="auth-log-stream"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  globalAcousticMesh3D.start('auth-mesh3d-canvas', audioEngine ? audioEngine.getAnalyser() : null);

  // Sub-tabs switching
  const tabInstantBtn = el.querySelector('#auth-subtab-instant') as HTMLButtonElement;
  const tabCustomBtn = el.querySelector('#auth-subtab-custom') as HTMLButtonElement;
  tabInstantBtn.addEventListener('click', () => {
    authActiveTab = 'instant';
    render();
  });
  tabCustomBtn.addEventListener('click', () => {
    authActiveTab = 'custom';
    render();
  });

  // Tab 1: Instant Alert Preview updates
  const templateSelect = el.querySelector('#auth-template') as HTMLSelectElement;
  const modularSubject = el.querySelector('#modular-subject') as HTMLSelectElement;
  const modularAction = el.querySelector('#modular-action') as HTMLSelectElement;
  const modularLocation = el.querySelector('#modular-location') as HTMLSelectElement;
  const useModularCheck = el.querySelector('#auth-use-modular') as HTMLInputElement;

  const updateInstantPreview = () => {
    selectedTemplateId = parseInt(templateSelect.value);
    modularSubjectId = parseInt(modularSubject.value);
    modularActionId = parseInt(modularAction.value);
    modularLocationId = parseInt(modularLocation.value);
    useModularSentence = useModularCheck.checked;

    if (useModularSentence) {
      el.querySelector('#preview-en')!.textContent = renderModularAlert(modularSubjectId, modularActionId, modularLocationId, 'en');
      el.querySelector('#preview-ml')!.textContent = renderModularAlert(modularSubjectId, modularActionId, modularLocationId, 'ml');
      el.querySelector('#preview-hi')!.textContent = renderModularAlert(modularSubjectId, modularActionId, modularLocationId, 'hi');
    } else {
      const tpl = TEMPLATES.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        el.querySelector('#preview-en')!.textContent = tpl.en;
        el.querySelector('#preview-ml')!.textContent = tpl.ml;
        el.querySelector('#preview-hi')!.textContent = tpl.hi;
      }
    }
  };

  templateSelect.addEventListener('change', updateInstantPreview);
  modularSubject.addEventListener('change', updateInstantPreview);
  modularAction.addEventListener('change', updateInstantPreview);
  modularLocation.addEventListener('change', updateInstantPreview);
  useModularCheck.addEventListener('change', updateInstantPreview);
  updateInstantPreview();

  // Tab 2: Custom Pager updates
  const pagerInput = el.querySelector('#custom-pager-input') as HTMLInputElement;
  const pagerCounter = el.querySelector('#pager-byte-counter') as HTMLElement;
  const pagerBadge = el.querySelector('#pager-script-badge') as HTMLElement;
  const pagerOrigBadge = el.querySelector('#pager-orig-badge') as HTMLElement;
  const customEn = el.querySelector('#custom-preview-en') as HTMLElement;
  const customMl = el.querySelector('#custom-preview-ml') as HTMLElement;
  const customHi = el.querySelector('#custom-preview-hi') as HTMLElement;

  const updatePagerPreview = (val: string) => {
    customPagerText = val;
    const { scriptId, bytes } = encodeIndicString(val, 6);
    const byteLen = bytes.length;
    pagerCounter.textContent = `${byteLen} / 6 Compressed Bytes (66% airtime saved)`;
    pagerBadge.textContent = getScriptLabel(scriptId);

    if (val.trim()) {
      pagerOrigBadge.textContent = `[Orig: ${val.trim()}]`;

      const tEn = translateCustomText(val, scriptId, 'en');
      const tMl = translateCustomText(val, scriptId, 'ml');
      const tHi = translateCustomText(val, scriptId, 'hi');

      customEn.textContent = tEn.translatedText || val;
      customMl.textContent = tMl.translatedText || val;
      customHi.textContent = tHi.translatedText || val;
    } else {
      pagerOrigBadge.textContent = '[Orig: —]';
      customEn.textContent = 'Waiting for text...';
      customMl.textContent = '—';
      customHi.textContent = '—';
    }
  };

  pagerInput.addEventListener('input', () => {
    updatePagerPreview(pagerInput.value);
  });
  if (customPagerText) {
    updatePagerPreview(customPagerText);
  }

  // Quick Chips
  el.querySelectorAll('.chip-pager').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-text') || '';
      pagerInput.value = text;
      updatePagerPreview(text);
    });
  });

  // Target Destination Selector Events
  bindTargetSelectorEvents(
    el,
    { targetType: authTargetType, unicastHex: authUnicastHex },
    (newState, shouldRerender = true) => {
      authTargetType = newState.targetType;
      authUnicastHex = newState.unicastHex;
      if (shouldRerender) {
        render();
      }
    }
  );

  // Broadcast Instant Alert
  el.querySelector('#auth-broadcast-btn')!.addEventListener('click', async () => {
    const targetNodeId = resolveTargetNodeId(authTargetType, authUnicastHex);
    isAuthorityBroadcasting = true;
    render();

    await initAudio();
    if (useModularSentence) {
      await sendAuthorityBeacon(0xff, new Uint8Array([modularSubjectId, modularActionId, modularLocationId]), targetNodeId);
    } else {
      await sendAuthorityBeacon(selectedTemplateId, undefined, targetNodeId);
    }

    isAuthorityBroadcasting = false;
    render();
  });

  // Broadcast Custom Pager Chirp
  el.querySelector('#auth-broadcast-custom-btn')!.addEventListener('click', async () => {
    if (!customPagerText.trim()) {
      alert('Please enter pager text first (e.g. HELP, WATER, or Malayalam)');
      return;
    }

    const targetNodeId = resolveTargetNodeId(authTargetType, authUnicastHex);
    isAuthorityBroadcasting = true;
    render();

    await initAudio();
    await sendCustomPagerBeacon(customPagerText.trim(), targetNodeId);

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
    <div class="flex justify-between items-center mb-16">
      <div>
        <h1 style="font-family: var(--font-display); font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">The Wall · Room Race Monitor</h1>
        <p class="text-secondary" style="font-size: 13px; margin-top: 2px;">Live acoustic propagation telemetry and full-spectrum waterfall for projector display.</p>
      </div>
      <div class="flex gap-8 items-center">
        <button class="btn btn-outline" id="wall-fullscreen-btn">
          ${ICONS.fullscreen}
          <span>${isFullscreen ? 'Exit Fullscreen' : 'Projector Fullscreen'}</span>
        </button>
        <button class="btn btn-primary" id="wall-start-btn">
          ${ICONS.mic}
          <span>Arm Wall Listener</span>
        </button>
      </div>
    </div>

    <div class="cockpit-grid mb-16">
      <!-- Live 2D Spectrogram Waterfall for Big Screen Spectacle -->
      <div class="card mb-0">
        <div class="card-header-bar">
          <div class="card-title">
            ${ICONS.radioWave}
            <span>Acoustic Spectrogram Waterfall (1.8 - 6.3 kHz)</span>
          </div>
          <span class="brand-channel-tag">96 FSK BINS</span>
        </div>
        <div class="instrument-housing">
          <canvas id="wall-waterfall-canvas" class="waterfall-canvas" width="680" height="200"></canvas>
          <div class="instrument-scale-bar">
            <span>1.8 kHz FSK BASE</span>
            <span>3.0 kHz</span>
            <span>4.5 kHz</span>
            <span>6.3 kHz FSK PEAK</span>
          </div>
        </div>
      </div>

      <!-- Live 3D Holographic Acoustic Sphere -->
      <div class="card mb-0">
        <div class="card-header-bar">
          <div class="card-title">
            ${ICONS.wall}
            <span>3D Acoustic Topology Sphere</span>
          </div>
          <span class="brand-channel-tag">LIVE TOPOLOGY</span>
        </div>
        <div class="instrument-housing">
          <div class="mesh3d-container" style="height: 200px;">
            <canvas id="wall-mesh3d-canvas" class="mesh3d-canvas" width="500" height="200"></canvas>
          </div>
          <div class="instrument-scale-bar">
            <span>54 FIBONACCI NODES</span>
            <span>AUDIO REACTIVE GEODESIC</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Race Clock Hero Card -->
    <div class="race-timer-hero mb-16">
      <div class="text-muted font-mono mb-8" style="font-size: 11px; letter-spacing: 1.5px;">ACOUSTIC PROPAGATION LATENCY</div>
      <div class="flex justify-center items-baseline">
        <span class="race-clock-digits" id="wall-race-digits">00.00</span>
        <span class="race-clock-unit">SEC</span>
      </div>
      <div class="flex justify-center gap-12 mt-12 text-muted font-mono" style="font-size: 12px;">
        <span>FIRST HOP: <strong id="wall-race-first-hop" class="text-gold">WAITING</strong></span>
        <span>•</span>
        <span>PEAK REACH: <strong id="wall-race-peak-hop" class="text-gold">0 HOPS</strong></span>
      </div>
    </div>

    <!-- Counter Metric Grid -->
    <div class="counter-grid counter-grid-4 mb-16">
      <div class="counter-item">
        <div class="counter-value" id="wall-c-frames">${wallFrameCount}</div>
        <div class="counter-label">Frames Received</div>
      </div>
      <div class="counter-item">
        <div class="counter-value" id="wall-c-hops">${wallMaxHop}</div>
        <div class="counter-label">Max Hop Level</div>
      </div>
      <div class="counter-item">
        <div class="counter-value text-patina" id="wall-c-mac">100%</div>
        <div class="counter-label">MAC Verified</div>
      </div>
      <div class="counter-item">
        <div class="counter-value" id="wall-c-loss">0.0%</div>
        <div class="counter-label">Observed Loss</div>
      </div>
    </div>

    <!-- Real time Reception Waterfall Card -->
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
      <div class="terminal-card">
        <div class="terminal-header">
          <div class="terminal-dots">
            <div class="terminal-dot red"></div>
            <div class="terminal-dot yellow"></div>
            <div class="terminal-dot green"></div>
          </div>
          <div class="terminal-title">Mesh Telemetry Waterfall</div>
        </div>
        <div class="terminal-log" id="wall-timeline" style="max-height: 240px;">
          ${wallFrameCount === 0 ? '<div class="text-muted">Waiting for acoustic broadcast waves. Arm listener and broadcast from Authority.</div>' : ''}
        </div>
      </div>
    </div>
  `;

  spectrogram.start('wall-waterfall-canvas', audioEngine ? audioEngine.getAnalyser() : null);
  globalAcousticMesh3D.start('wall-mesh3d-canvas', audioEngine ? audioEngine.getAnalyser() : null);

  el.querySelector('#wall-fullscreen-btn')!.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  el.querySelector('#wall-start-btn')!.addEventListener('click', async () => {
    await initAudio();
    await initRelay();
    await audioEngine!.startListening();
    spectrogram.start('wall-waterfall-canvas', audioEngine!.getAnalyser());
    globalAcousticMesh3D.start('wall-mesh3d-canvas', audioEngine!.getAnalyser());
    updateUIStatus();
  });

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

function playTone(freq: number, duration = 0.35): void {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// SCREEN 4: ACOUSTIC LAB (DSP Diagnostics & Field Verification)
// ─────────────────────────────────────────────────────────────
function renderLab(el: HTMLElement): void {
  const currentState = audioEngine ? audioEngine.getState() : 'IDLE';

  el.innerHTML = `
    <div class="flex justify-between items-center mb-16">
      <div>
        <h1 style="font-family: var(--font-display); font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">Acoustic DSP Lab</h1>
        <p class="text-secondary" style="font-size: 13px; margin-top: 2px;">Modem diagnostics, 14-byte compact frame verification, and frequency testing.</p>
      </div>
      <div class="hardware-segmented-control" style="width: 200px;">
        <button class="hardware-segment-btn ${labMode === 'receiver' ? 'active' : ''}" id="lab-mode-rx">Receiver</button>
        <button class="hardware-segment-btn ${labMode === 'sender' ? 'active' : ''}" id="lab-mode-tx">Sender</button>
      </div>
    </div>


    <div class="cockpit-grid">
      <!-- Left Column: Modem Parameters & Live Waterfall -->
      <div>
        <!-- Modulation & Distance Settings Card -->
        <div class="card">
          <div class="card-title">
            ${ICONS.lab}
            <span>Modem Parameters</span>
          </div>
          <div class="flex gap-8 mb-8">
            <div class="flex-1">
              <label class="text-muted" style="font-size: 11px;">PROTOCOL PROFILE</label>
              <select id="lab-protocol" class="mt-4">
                <option value="GGWAVE_PROTOCOL_AUDIBLE_FAST" ${labProtocol === 'GGWAVE_PROTOCOL_AUDIBLE_FAST' ? 'selected' : ''}>Audible Fast (16 B/s)</option>
                <option value="GGWAVE_PROTOCOL_AUDIBLE_NORMAL" ${labProtocol === 'GGWAVE_PROTOCOL_AUDIBLE_NORMAL' ? 'selected' : ''}>Audible Normal (8 B/s)</option>
                <option value="GGWAVE_PROTOCOL_AUDIBLE_FASTEST" ${labProtocol === 'GGWAVE_PROTOCOL_AUDIBLE_FASTEST' ? 'selected' : ''}>Audible Fastest (32 B/s)</option>
              </select>
            </div>
            <div style="width: 110px;">
              <label class="text-muted" style="font-size: 11px;">DISTANCE (M)</label>
              <input type="text" id="lab-distance" value="${labDistance}" class="mt-4" placeholder="1m, 3m" />
            </div>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-outline btn-sm flex-1" id="lab-test-strobe">
              ${ICONS.alertTriangle}
              <span>Test Wave Strobe Flash</span>
            </button>
          </div>
        </div>

        <!-- Live Audio Waterfall Card -->
        <div class="card">
          <div class="card-header-bar">
            <div class="card-title">
              ${ICONS.radioWave}
              <span>Microphone Spectrogram Waterfall</span>
            </div>
            <div id="lab-status" class="status-badge status-${currentState.toLowerCase()}">
              <div class="status-indicator-dot"></div>
              <span>${currentState}</span>
            </div>
          </div>

          <div class="instrument-housing">
            <canvas id="lab-waterfall-canvas" class="waterfall-canvas" width="600" height="140"></canvas>
            <div class="instrument-scale-bar">
              <span>1.8 kHz</span>
              <span>3.5 kHz</span>
              <span>5.0 kHz</span>
              <span>6.3 kHz</span>
            </div>
          </div>

          <div class="vu-meter-housing">
            <div class="vu-meter-top">
              <span>SPECTRUM ENERGY</span>
              <span id="lab-samplerate" class="font-mono text-marine">48000 Hz</span>
            </div>
            <div class="vu-meter-track">
              <div class="vu-meter-bar" id="lab-level"></div>
            </div>
          </div>

          <div class="flex gap-8 mt-16">
            <button class="btn btn-primary flex-1" id="lab-start">
              ${ICONS.mic}
              <span>${currentState === 'LISTEN' ? 'Listening Active' : 'Start Mic Stream'}</span>
            </button>
            <button class="btn btn-outline btn-icon" id="lab-test-tone" title="Test Audio Tone">
              ${ICONS.speaker}
            </button>
          </div>
        </div>

        <!-- Audio Tone Synthesizer Keys -->
        <div class="card">
          <div class="card-title">
            ${ICONS.speaker}
            <span>Acoustic Frequency Synthesizer</span>
          </div>
          <p class="text-secondary" style="font-size: 12px; margin-top: 4px;">Tap individual carrier frequencies to test phone speaker output:</p>
          <div class="synth-key-grid">
            <button class="synth-key-btn" data-freq="1875">
              <span class="synth-freq">1.88 kHz</span>
              <span class="synth-label">Base Subband</span>
            </button>
            <button class="synth-key-btn" data-freq="3375">
              <span class="synth-freq">3.38 kHz</span>
              <span class="synth-label">Mid Subband</span>
            </button>
            <button class="synth-key-btn" data-freq="4875">
              <span class="synth-freq">4.88 kHz</span>
              <span class="synth-label">Upper Band</span>
            </button>
            <button class="synth-key-btn" data-freq="6375">
              <span class="synth-freq">6.38 kHz</span>
              <span class="synth-label">Peak Carrier</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Column: Sender, Delivery Counters & Logs -->
      <div>
        <!-- Sender Panel (Only in Sender mode) -->
        <div class="card" id="lab-sender-panel" ${labMode !== 'sender' ? 'style="display:none"' : ''}>
          <div class="card-title">
            ${ICONS.send}
            <span>Acoustic Test Packet Injector (13 Bytes)</span>
          </div>
          <p class="text-secondary mb-8" style="font-size: 13px;">Current Sequence: <strong id="lab-msg-index" class="text-gold">ECHO${(labMsgIndex + 1).toString().padStart(3, '0')}</strong> (~0.8s chirp)</p>
          <button class="btn btn-primary w-full" id="lab-send">
            ${ICONS.send}
            <span>Transmit Compact Packet</span>
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
              <div class="counter-value text-cyan" id="lab-c-sent">${labCounter.sent}</div>
              <div class="counter-label">Frames Sent</div>
            </div>
            <div class="counter-item">
              <div class="counter-value text-patina" id="lab-c-decoded">${labCounter.decoded}</div>
              <div class="counter-label">Decoded Clean</div>
            </div>
            <div class="counter-item">
              <div class="counter-value text-vermilion" id="lab-c-failed">${labCounter.failed}</div>
              <div class="counter-label">Decode Failed</div>
            </div>
            <div class="counter-item">
              <div class="counter-value text-violet" id="lab-c-errors">${labCounter.correctedErrors}</div>
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
          <p class="text-secondary mb-8" style="font-size: 12px; line-height: 1.5;">Passes synthesized Float32Array PCM samples directly from ggwave encoder to decoder in RAM.</p>
          <button class="btn btn-outline w-full" id="lab-loopback">
            ${ICONS.play}
            <span>Run RAM Self Test</span>
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
          <div class="terminal-card">
            <div class="terminal-header">
              <div class="terminal-dots">
                <div class="terminal-dot red"></div>
                <div class="terminal-dot yellow"></div>
                <div class="terminal-dot green"></div>
              </div>
              <div class="terminal-title">Acoustic Event Terminal</div>
            </div>
            <div class="terminal-log" id="lab-log"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  spectrogram.start('lab-waterfall-canvas', audioEngine ? audioEngine.getAnalyser() : null);

  el.querySelector('#lab-test-strobe')!.addEventListener('click', () => {
    triggerScreenFlash('emerald', 'WAVE PROPAGATING', 'HOP 1 // ACOUSTIC RELAY SYNC');
  });

  el.querySelector('#lab-mode-rx')!.addEventListener('click', () => {
    labMode = 'receiver';
    render();
  });
  el.querySelector('#lab-mode-tx')!.addEventListener('click', () => {
    labMode = 'sender';
    render();
  });

  el.querySelector('#lab-protocol')!.addEventListener('change', (e) => {
    labProtocol = (e.target as HTMLSelectElement).value;
  });
  el.querySelector('#lab-distance')!.addEventListener('input', (e) => {
    labDistance = (e.target as HTMLInputElement).value;
  });

  el.querySelector('#lab-start')!.addEventListener('click', async () => {
    await initAudio();
    if (audioEngine) {
      await audioEngine.startListening();
      spectrogram.start('lab-waterfall-canvas', audioEngine.getAnalyser());
      updateUIStatus();
    }
  });

  el.querySelector('#lab-test-tone')!.addEventListener('click', async () => {
    if (!audioEngine) await initAudio();
    audioEngine?.playTestTone();
  });

  el.querySelectorAll('.synth-key-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const freq = parseFloat((btn as HTMLElement).dataset.freq || '1875');
      playTone(freq, 0.35);
    });
  });

  el.querySelector('#lab-send')?.addEventListener('click', async () => {
    if (!audioEngine) await initAudio();
    labMsgIndex++;
    const msg = `ECHO${labMsgIndex.toString().padStart(3, '0')}`;
    labCounter.sent++;
    updateLabCounters();
    appendLabLog('TX', msg);
    await logEvent({
      timestamp: Date.now(),
      event: 'sent',
      protocol: labProtocol,
      distance: labDistance,
      meta: { msg },
    });
    await audioEngine!.transmit(msg);
  });

  el.querySelector('#lab-export-csv')!.addEventListener('click', async () => {
    const csv = await exportCSV();
    downloadFile('airgap-lab.csv', csv, 'text/csv');
  });
  el.querySelector('#lab-export-json')!.addEventListener('click', async () => {
    const json = await exportJSON();
    downloadFile('airgap-lab.json', json, 'application/json');
  });
  el.querySelector('#lab-clear')!.addEventListener('click', async () => {
    await clearLogs();
    labCounter = { sent: 0, decoded: 0, failed: 0, correctedErrors: 0 };
    labMsgIndex = 0;
    render();
  });

  el.querySelector('#lab-loopback')!.addEventListener('click', runLoopbackTest);
}

// ─────────────────────────────────────────────────────────────
// SCREEN 5: SIMULATOR (Acoustic Room Mesh Simulation)
// ─────────────────────────────────────────────────────────────
function renderSim(el: HTMLElement): void {
  el.innerHTML = `
    <div class="sim-watermark-badge">Synthetic Acoustic Mesh Propagation Simulation</div>
    <h1>Mesh Simulator</h1>
    <p class="text-secondary mb-12">Simulate acoustic hop propagation across 10 to 100 phones in a room.</p>

    <div class="cockpit-grid">
      <!-- Left Column: Simulation Parameters -->
      <div>
        <div class="card">
          <div class="card-title">
            ${ICONS.sim}
            <span>Room & Mesh Parameters</span>
          </div>

          <div class="flex gap-8 mb-8">
            <div class="flex-1">
              <label class="text-muted" style="font-size: 11px;">NODE COUNT (PHONES)</label>
              <input type="number" id="sim-nodes" value="50" min="5" max="100" class="mt-4" />
            </div>
            <div class="flex-1">
              <label class="text-muted" style="font-size: 11px;">ROOM DIMENSION (M)</label>
              <input type="number" id="sim-room" value="10" min="4" max="50" class="mt-4" />
            </div>
          </div>

          <div class="flex gap-8 mb-12">
            <div class="flex-1">
              <label class="text-muted" style="font-size: 11px;">ACOUSTIC RANGE (M)</label>
              <input type="number" id="sim-range" value="4" min="1" max="15" class="mt-4" />
            </div>
            <div class="flex-1">
              <label class="text-muted" style="font-size: 11px;">ACOUSTIC LOSS (%)</label>
              <input type="number" id="sim-loss" value="30" min="0" max="80" class="mt-4" />
            </div>
          </div>

          <button class="btn btn-primary w-full" id="sim-run">
            ${ICONS.play}
            <span>Run Room Mesh Simulation</span>
          </button>
        </div>

        <div class="card">
          <div class="card-title">
            ${ICONS.shieldCheck}
            <span>Hop Propagation Topology</span>
          </div>
          <div class="flex flex-col gap-6 text-faint font-mono" style="font-size: 12px;">
            <div class="flex items-center gap-8"><span class="text-vermilion font-bold">●</span> Origin (Civil Authority Node)</div>
            <div class="flex items-center gap-8"><span class="text-cyan font-bold">●</span> Hop 1 (Direct Acoustic Reception)</div>
            <div class="flex items-center gap-8"><span class="text-patina font-bold">●</span> Hop 2 (First Relay Wave)</div>
            <div class="flex items-center gap-8"><span class="text-gold font-bold">●</span> Hop 3+ (Multi-hop Room Cascade)</div>
            <div class="flex items-center gap-8"><span style="color: #64748b;">●</span> Unreached Node (Acoustic Shadow)</div>
          </div>
        </div>
      </div>

      <!-- Right Column: Results & Interactive Canvas -->
      <div>
        <div class="card" id="sim-results" style="display: none;">
          <div class="card-title">
            ${ICONS.wall}
            <span>Propagation Results</span>
          </div>
          <div class="counter-grid counter-grid-4 mb-12" id="sim-stats"></div>

          <div class="sim-canvas-wrapper">
            <canvas id="sim-canvas" width="600" height="400" style="width: 100%; display: block;"></canvas>
          </div>
        </div>
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

  // Auto-run once on mount for immediate visual feedback
  setTimeout(() => {
    (el.querySelector('#sim-run') as HTMLButtonElement)?.click();
  }, 50);
}

// ─────────────────────────────────────────────────────────────
// Canvas Simulation Renderer (High-Tech Radar & Mesh Connections)
// ─────────────────────────────────────────────────────────────
function displaySimResults(result: SimResult): void {
  const el = document.getElementById('sim-results')!;
  el.style.display = 'block';

  document.getElementById('sim-stats')!.innerHTML = `
    <div class="counter-item">
      <div class="counter-value text-gold">${result.coveragePercent.toFixed(0)}%</div>
      <div class="counter-label">Coverage</div>
    </div>
    <div class="counter-item">
      <div class="counter-value text-cyan">${result.maxHop}</div>
      <div class="counter-label">Max Hops</div>
    </div>
    <div class="counter-item">
      <div class="counter-value text-patina">${result.totalTransmissions}</div>
      <div class="counter-label">Transmissions</div>
    </div>
    <div class="counter-item">
      <div class="counter-value text-violet">${(result.timeToLastNode / 1000).toFixed(2)}s</div>
      <div class="counter-label">Time to Reach</div>
    </div>
  `;

  const canvas = document.getElementById('sim-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  // Cosmic dark canvas
  ctx.fillStyle = '#070a14';
  ctx.fillRect(0, 0, w, h);

  // Subtle coordinate grid
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
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

  // Draw acoustic propagation laser lines
  ctx.lineWidth = 1.2;
  for (const node of result.nodes) {
    if (node.reached && node.hopReceived > 0) {
      const nx = 20 + node.x * scaleX;
      const ny = 20 + node.y * scaleY;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.22)';
      ctx.beginPath();
      ctx.arc(nx, ny, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Draw nodes
  for (const node of result.nodes) {
    const x = 20 + node.x * scaleX;
    const y = 20 + node.y * scaleY;

    ctx.beginPath();
    ctx.arc(x, y, node.id === 0 ? 10 : 6, 0, Math.PI * 2);

    if (node.id === 0) {
      // Origin node glows coral
      ctx.fillStyle = '#ff2a5f';
      ctx.shadowColor = '#ff2a5f';
      ctx.shadowBlur = 14;
    } else if (node.reached) {
      if (node.hopReceived === 1) {
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 8;
      } else if (node.hopReceived === 2) {
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 6;
      }
    } else {
      ctx.fillStyle = '#334155';
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.fill();

    if (node.reached && node.id !== 0) {
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '10px monospace';
      ctx.shadowBlur = 0;
      ctx.fillText(String(node.hopReceived), x + 8, y + 4);
    }
  }
  ctx.shadowBlur = 0;
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
    ctx.fillStyle = '#040508';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const analyser = audioEngine?.getAnalyser();
    if (!analyser || audioEngine?.getState() !== 'LISTEN') {
      ctx.strokeStyle = 'rgba(246, 196, 69, 0.2)';
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
    ctx.strokeStyle = '#f6c445';
    ctx.shadowColor = '#f6c445';
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

  relayEngine = new RelayEngine({}, undefined, eventEpoch, myNodeId);

  relayEngine.setTransmitCallback(async (frameBytes) => {
    if (audioEngine) {
      triggerScreenFlash('emerald', 'RELAYING HOP', 'ACOUSTIC BURST EMITTED');
      await audioEngine.transmitBytes(frameBytes);
    }
  });

  relayEngine.setAlertCallback((frame) => {
    let text = '';
    if (frame.type === FrameType.CUSTOM_PAGER && frame.customText) {
      const trans = translateCustomText(
        frame.customText,
        frame.scriptId ?? ScriptId.ASCII,
        language
      );
      text = trans.translatedText || frame.customText;
    } else if (frame.templateId === 0xff && frame.params && frame.params.length >= 3) {
      text = renderModularAlert(
        frame.params[0],
        frame.params[1],
        frame.params[2],
        language
      );
    } else {
      text = renderTemplate(frame.templateId ?? 1, language, frame.params);
    }
    showAlert(text, frame);
  });
}

// ─────────────────────────────────────────────────────────────
// Audio Callbacks & Relay Processing
// ─────────────────────────────────────────────────────────────
function handleDecode(data: Uint8Array): void {
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
  console.error('AirGap.fm AudioEngine Error:', msg);
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
    else if (pct < 35) dbText.textContent = 'FSK ENERGY DETECTED';
    else dbText.textContent = 'HIGH AUDIO LEVEL';
  }
}

// ─────────────────────────────────────────────────────────────
// Authority Broadcast Sequencer
// ─────────────────────────────────────────────────────────────
async function sendAuthorityBeacon(
  templateId: number,
  modularParams?: Uint8Array,
  targetNodeId: number = NODE_ID_BROADCAST
): Promise<void> {
  if (!audioEngine) return;

  const alertId = Math.floor(Math.random() * 0xffff);
  const timeBucket = getTimeBucket(eventEpoch, Date.now());

  const frame: BeaconFrame = {
    version: FRAME_VERSION,
    type: FrameType.TEMPLATE_ALERT,
    scriptId: ScriptId.ASCII,
    targetNodeId,
    alertId,
    templateId,
    regionCode: 0,
    params: modularParams ?? new Uint8Array([0, 0, 0]),
    originTimeBucket: timeBucket,
    hop: 0,
    ttl: DEFAULT_CONFIG.ttl,
    mac: new Uint8Array(4),
  };

  const encoded = encodeFrame(frame);
  const immutable = getImmutableBytes(encoded);
  frame.mac = await computeMAC(immutable);

  const frameBytes = encodeFrame(frame);

  const logCard = document.getElementById('auth-log-card');
  if (logCard) logCard.style.display = 'block';
  const logStream = document.getElementById('auth-log-stream');
  const targetLabel = formatNodeId(targetNodeId);

  for (let i = 0; i < DEFAULT_CONFIG.authorityRepeatCount; i++) {
    const repeatLabel = `Beacon ${i + 1}/${DEFAULT_CONFIG.authorityRepeatCount} • Target: ${targetLabel} • Alert 0x${alertId.toString(16).toUpperCase()} (${frameBytes.length}B)`;
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

    triggerScreenFlash('crimson', 'ORIGIN BEACON TX', `TARGET: ${targetLabel} · 0x${alertId.toString(16).toUpperCase()}`);
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
        <span class="log-tag ok">OK</span>
        <span class="log-msg text-patina">14 byte frame broadcast sequence completed to ${targetLabel}.</span>
      </div>
    `;
    logStream.scrollTop = logStream.scrollHeight;
  }
}

async function sendCustomPagerBeacon(
  text: string,
  targetNodeId: number = NODE_ID_BROADCAST
): Promise<void> {
  if (!audioEngine) return;

  const alertId = Math.floor(Math.random() * 0xffff);
  const { scriptId, bytes } = encodeIndicString(text, 5);

  // Pad to 5 bytes for 14-byte frame layout
  const padded = new Uint8Array(5);
  for (let i = 0; i < 5; i++) {
    padded[i] = i < bytes.length ? bytes[i] : (scriptId === ScriptId.ASCII ? 0x00 : 0x80);
  }

  const frame: BeaconFrame = {
    version: FRAME_VERSION,
    type: FrameType.CUSTOM_PAGER,
    scriptId,
    targetNodeId,
    alertId,
    customPayload: padded,
    customText: text,
    hop: 0,
    ttl: DEFAULT_CONFIG.ttl,
    mac: new Uint8Array(4),
  };

  const encoded = encodeFrame(frame);
  const immutable = getImmutableBytes(encoded);
  frame.mac = await computeMAC(immutable);

  const frameBytes = encodeFrame(frame);

  const logCard = document.getElementById('auth-log-card');
  if (logCard) logCard.style.display = 'block';
  const logStream = document.getElementById('auth-log-stream');
  const targetLabel = formatNodeId(targetNodeId);

  for (let i = 0; i < DEFAULT_CONFIG.authorityRepeatCount; i++) {
    const repeatLabel = `Pager Chirp ${i + 1}/${DEFAULT_CONFIG.authorityRepeatCount} • Target: ${targetLabel} • Alert 0x${alertId.toString(16).toUpperCase()} • "${text}" (${frameBytes.length}B)`;
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

    const btnText = document.getElementById('auth-custom-btn-text');
    if (btnText) {
      btnText.textContent = `Transmitting ${i + 1}/${DEFAULT_CONFIG.authorityRepeatCount}...`;
    }

    triggerScreenFlash('crimson', 'CUSTOM PAGER TX', `TARGET: ${targetLabel} · "${text}" (${frameBytes.length}B)`);
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
        <span class="log-tag ok">OK</span>
        <span class="log-msg text-patina">14 byte 1-byte Indic compressed chirp burst completed to ${targetLabel}.</span>
      </div>
    `;
    logStream.scrollTop = logStream.scrollHeight;
  }
}

// ─────────────────────────────────────────────────────────────
// UI Helpers & Telemetry Updaters
// ─────────────────────────────────────────────────────────────
function showAlert(text: string, frame: BeaconFrame): void {
  const isCustom = frame.type === FrameType.CUSTOM_PAGER;
  const isModular = frame.templateId === 0xff;
  const isBroadcast = frame.targetNodeId === NODE_ID_BROADCAST;
  const isWallSink = frame.targetNodeId === NODE_ID_WALL;
  const isDestination = !isBroadcast && frame.targetNodeId === myNodeId;
  const isIntermediate = !isBroadcast && !isWallSink && frame.targetNodeId !== myNodeId;

  const targetHex = toHexId(frame.targetNodeId);

  // Intermediate Relay Node:
  // Do NOT reveal payload on screen; flash subtle Amber routing banner and allow Trickle relay to forward.
  if (isIntermediate && currentScreen !== 'wall') {
    triggerScreenFlash('amber', `ROUTING PACKET TO #${targetHex}`, `HOP ${frame.hop} · FORWARDING ACROSS MESH`);

    if (currentScreen === 'listener') {
      const routingBanner = document.getElementById('listener-routing-banner');
      if (routingBanner) {
        routingBanner.style.display = 'block';
        const titleEl = document.getElementById('routing-banner-title');
        if (titleEl) {
          titleEl.textContent = `ROUTING PACKET TO #${targetHex} • HOP ${frame.hop}`;
        }
        const descEl = document.getElementById('routing-banner-desc');
        if (descEl) {
          descEl.textContent = `Message payload masked for destination privacy. Trickle gossip relay scheduled to forward acoustic pulse to target device #${targetHex}.`;
        }
      }
      const alertCard = document.getElementById('listener-alert-card');
      if (alertCard) alertCard.style.display = 'none';
    }
    return;
  }

  // Destination Node reached!
  // Flash screen bright Cyan, play arrival chime, unlock full translated message with [DIRECT MESSAGE TO #ID] badge.
  if (isDestination && currentScreen !== 'wall') {
    triggerScreenFlash('cyan', `DIRECT MESSAGE TO #${toHexId(myNodeId)}`, `HOP ${frame.hop} · TARGET REACHED`);
    audioEngine?.playArrivalChime();

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch { /* ignore */ }
    }

    if (currentScreen === 'listener') {
      const routingBanner = document.getElementById('listener-routing-banner');
      if (routingBanner) routingBanner.style.display = 'none';

      const alertCard = document.getElementById('listener-alert-card');
      if (alertCard) {
        alertCard.style.display = 'block';
        const directBadge = document.getElementById('listener-direct-badge');
        if (directBadge) {
          directBadge.style.display = 'block';
          directBadge.innerHTML = `
            <span class="chip font-mono" style="background: rgba(6, 182, 212, 0.15); color: #0891b2; border: 1.5px solid #06b6d4; font-weight: 800; padding: 4px 10px;">
              [DIRECT MESSAGE TO #${toHexId(myNodeId)}]
            </span>
          `;
        }
        const targetVal = document.getElementById('listener-target-val');
        if (targetVal) targetVal.textContent = `#${toHexId(myNodeId)} (This Device)`;

        const textEl = document.getElementById('listener-alert-text')!;
        if (isCustom && frame.customText) {
          textEl.innerHTML = `
            <div style="font-size: 22px; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">${text}</div>
            <div class="flex items-center gap-6 mt-4">
              <span class="chip" style="font-size: 11px; font-weight: 700; background: var(--color-amber-subtle); color: var(--color-amber); border: 1px solid var(--color-amber-border);">[Orig: ${frame.customText}]</span>
              <span class="chip" style="font-size: 11px; font-weight: 600;">1-Byte Indic Decoded</span>
            </div>
          `;
        } else {
          textEl.textContent = text;
        }
        document.getElementById('listener-hop-val')!.textContent = String(frame.hop);
        document.getElementById('listener-alert-id')!.textContent = `0x${frame.alertId.toString(16).toUpperCase()}`;
      }
    }
    return;
  }

  // Room Broadcast:
  // Every receiving node displays full alert card, flashes Emerald Green, and schedules Trickle relay.
  const tag = isCustom ? 'CUSTOM PAGER' : isModular ? 'MODULAR ALERT' : 'EMERGENCY BEACON';
  triggerScreenFlash('emerald', `HOP ${frame.hop} • ${tag}`, text.substring(0, 36));

  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch { /* ignore */ }
  }

  if (currentScreen === 'listener') {
    const routingBanner = document.getElementById('listener-routing-banner');
    if (routingBanner) routingBanner.style.display = 'none';

    const alertCard = document.getElementById('listener-alert-card');
    if (alertCard) {
      alertCard.style.display = 'block';
      const directBadge = document.getElementById('listener-direct-badge');
      if (directBadge) directBadge.style.display = 'none';

      const targetVal = document.getElementById('listener-target-val');
      if (targetVal) targetVal.textContent = 'BROADCAST (ALL)';

      const textEl = document.getElementById('listener-alert-text')!;
      if (isCustom && frame.customText) {
        textEl.innerHTML = `
          <div style="font-size: 22px; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">${text}</div>
          <div class="flex items-center gap-6 mt-4">
            <span class="chip" style="font-size: 11px; font-weight: 700; background: var(--color-amber-subtle); color: var(--color-amber); border: 1px solid var(--color-amber-border);">[Orig: ${frame.customText}]</span>
            <span class="chip" style="font-size: 11px; font-weight: 600;">1-Byte Indic Decoded</span>
          </div>
        `;
      } else {
        textEl.textContent = text;
      }
      document.getElementById('listener-hop-val')!.textContent = String(frame.hop);
      document.getElementById('listener-alert-id')!.textContent = `0x${frame.alertId.toString(16).toUpperCase()}`;
    }
  }
}

function updateUIStatus(): void {
  if (!audioEngine) return;
  const state = audioEngine.getState();

  const headerStateText = document.getElementById('header-state-text');
  if (headerStateText) headerStateText.textContent = state;
  const headerBadge = document.getElementById('header-audio-badge');
  if (headerBadge) {
    headerBadge.className = `status-badge status-${state.toLowerCase()}`;
  }

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

  const isBroadcast = frame.targetNodeId === NODE_ID_BROADCAST;
  const isWall = frame.targetNodeId === NODE_ID_WALL;
  const targetTag = isBroadcast
    ? '<span class="chip chip-sm" style="background: var(--color-emerald-subtle); color: var(--color-emerald); border: 1px solid var(--color-emerald-border);">ROOM BROADCAST</span>'
    : isWall
    ? '<span class="chip chip-sm" style="background: rgba(6, 182, 212, 0.15); color: #0891b2; border: 1px solid #06b6d4;">WALL SINK (#FF)</span>'
    : `<span class="chip chip-sm" style="background: var(--color-amber-subtle); color: var(--color-amber); border: 1px solid var(--color-amber-border);">TARGET → #${toHexId(frame.targetNodeId)}</span>`;

  triggerScreenFlash(
    isBroadcast ? 'emerald' : 'cyan',
    `HOP ${frame.hop} RECORDED`,
    isBroadcast ? `ALERT 0x${frame.alertId.toString(16).toUpperCase()}` : `TARGET #${toHexId(frame.targetNodeId)}`
  );

  if (wallFrameCount === 1) {
    wallFirstFrameTime = Date.now();
    if (wallRaceInterval) clearInterval(wallRaceInterval);
    wallRaceInterval = setInterval(() => {
      const elapsedMs = Date.now() - wallFirstFrameTime;
      const el = document.getElementById('wall-race-digits');
      if (el) el.textContent = (elapsedMs / 1000).toFixed(2);
    }, 50);
  }

  const elapsed = ((Date.now() - wallFirstFrameTime) / 1000).toFixed(2);
  const text = frame.customText || renderTemplate(frame.templateId ?? 1, 'en', frame.params);

  const timeline = document.getElementById('wall-timeline');
  if (timeline) {
    const time = new Date().toLocaleTimeString();
    timeline.innerHTML += `
      <div class="log-entry">
        <span class="log-time">${time} (+${elapsed}s)</span>
        <span class="log-tag rx">HOP ${frame.hop}</span>
        ${targetTag}
        <span class="log-msg"><strong>0x${frame.alertId.toString(16).toUpperCase()}</strong>: ${text}</span>
      </div>
    `;
    timeline.scrollTop = timeline.scrollHeight;
  }

  const set = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('wall-c-frames', String(wallFrameCount));
  set('wall-c-hops', String(wallMaxHop));
  set('wall-race-peak-hop', `${wallMaxHop} HOPS`);
  const firstHopEl = document.getElementById('wall-race-first-hop');
  if (firstHopEl && firstHopEl.textContent === 'WAITING') {
    firstHopEl.textContent = `HOP ${frame.hop}`;
  }
}

async function runLoopbackTest(): Promise<void> {
  const resultEl = document.getElementById('lab-loopback-result');
  if (!resultEl) return;

  resultEl.innerHTML = '<span class="text-muted">Testing RAM encode and decode...</span>';

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
      resultEl.innerHTML = '<span class="text-vermilion">FAIL: Empty waveform synthesized</span>';
      ggwave.free(instance);
      return;
    }

    const decoded = ggwave.decode(instance, waveform);
    ggwave.free(instance);

    if (decoded && decoded.length > 0) {
      const decodedStr = new TextDecoder().decode(decoded);
      if (decodedStr === testMsg) {
        resultEl.innerHTML = `<span class="text-patina">✓ PASS: In memory loopback succeeded (${waveform.length} PCM samples verified).</span>`;
      } else {
        resultEl.innerHTML = `<span class="text-gold">DIFF: Decoded "${decodedStr}" (expected "${testMsg}")</span>`;
      }
    } else {
      resultEl.innerHTML = '<span class="text-vermilion">FAIL: Decoder returned null on loopback samples</span>';
    }
  } catch (e) {
    resultEl.innerHTML = `<span class="text-vermilion">ERROR: ${e}</span>`;
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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    console.warn('AirGap.fm: Page hidden; background audio throttling may occur on iOS');
  }
});

render();
