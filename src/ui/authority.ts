/**
 * Target Destination Selector for AirGap.fm Acoustic Mesh (`src/ui/authority.ts`).
 * Strictly adheres to ANTI-EMOJI POLICY using high-precision vector SVG icons.
 *
 * Routing options:
 * - 0x00 Room Broadcast: Every phone displays, sounds alert, and forwards sound wave.
 * - 0x01..0xFE Direct Unicast: Only targeted recipient phone unlocks payload and rings.
 *   Intermediate phones forward the acoustic pulse silently with masked payload.
 * - 0xFF Projector Wall: Routes directly to room display sink.
 */

import { NODE_ID_BROADCAST, NODE_ID_WALL, parseNodeId, toHexId } from '../protocol/nodeId';
import { ICONS } from './icons';

export type TargetType = 'broadcast' | 'unicast' | 'wall';

export interface TargetSelectorState {
  targetType: TargetType;
  unicastHex: string;
}

/** Resolve numerical 1-byte targetNodeId from selector state */
export function resolveTargetNodeId(targetType: TargetType, unicastHex: string): number {
  if (targetType === 'broadcast') return NODE_ID_BROADCAST;
  if (targetType === 'wall') return NODE_ID_WALL;
  const parsed = parseNodeId(unicastHex);
  if (parsed !== null && parsed >= 0x01 && parsed <= 0xfe) {
    return parsed;
  }
  return NODE_ID_BROADCAST;
}

/** Render the HTML template for the Target Destination Selector */
export function renderTargetSelector(targetType: TargetType, unicastHex: string): string {
  const targetId = resolveTargetNodeId(targetType, unicastHex);
  const targetLabel =
    targetType === 'broadcast'
      ? '0x00 · Room Broadcast'
      : targetType === 'wall'
      ? '0xFF · Projector Wall'
      : `#${toHexId(targetId)} · Direct Unicast`;

  let explanation = '';
  if (targetType === 'broadcast') {
    explanation = `<span class="inline-icon" style="display:inline-flex; vertical-align:middle; margin-right:6px; color:var(--color-primary);">${ICONS.broadcast}</span><strong>Room Broadcast Mode:</strong> Every phone in earshot will ring, flash, show the alert, and forward the sound wave.`;
  } else if (targetType === 'unicast') {
    explanation = `<span class="inline-icon" style="display:inline-flex; vertical-align:middle; margin-right:6px; color:var(--color-cyan, #0891b2);">${ICONS.target}</span><strong>Direct Unicast Mode:</strong> Only phone <strong>#${unicastHex || '??'}</strong> rings, flashes Cyan, and unlocks this message. Intermediate phones forward the sound pulse silently with text masked.`;
  } else {
    explanation = `<span class="inline-icon" style="display:inline-flex; vertical-align:middle; margin-right:6px; color:var(--text-secondary);">${ICONS.wall}</span><strong>Projector Wall Mode:</strong> Beams message directly to the big room projector display to show live hop telemetry.`;
  }

  return `
    <div class="card p-12 mb-12" style="background: var(--bg-inset); border-radius: var(--radius-md); border: 1.5px solid var(--border-card);">
      <div class="flex justify-between items-center mb-8">
        <label class="text-xs text-secondary font-bold uppercase tracking-wider">Acoustic Message Destination</label>
        <span class="chip chip-sm font-mono ${targetType === 'unicast' ? 'text-cyan' : 'text-primary'}" id="auth-target-preview-chip">
          ${targetLabel}
        </span>
      </div>

      <div class="flex gap-6 mb-8 target-toggle-group">
        <button type="button" class="btn ${targetType === 'broadcast' ? 'btn-primary' : 'btn-outline'} flex-1 flex items-center justify-center gap-6" id="target-btn-broadcast">
          ${ICONS.broadcast}
          <span>Everyone in Room</span>
        </button>
        <button type="button" class="btn ${targetType === 'unicast' ? 'btn-primary' : 'btn-outline'} flex-1 flex items-center justify-center gap-6" id="target-btn-unicast">
          ${ICONS.target}
          <span>Direct Unicast (#ID)</span>
        </button>
        <button type="button" class="btn ${targetType === 'wall' ? 'btn-primary' : 'btn-outline'} flex-1 flex items-center justify-center gap-6" id="target-btn-wall">
          ${ICONS.wall}
          <span>Projector Wall</span>
        </button>
      </div>

      <div id="target-unicast-input-box" class="mb-8" style="${targetType === 'unicast' ? '' : 'display: none;'}">
        <div class="p-8" style="background: #ffffff; border-radius: var(--radius-sm); border: 1.5px solid var(--border-strong);">
          <div class="flex items-center gap-8">
            <span class="text-xs font-mono font-bold text-secondary">TARGET RECIPIENT PHONE:</span>
            <span class="font-mono text-cyan font-bold" style="font-size: 16px;">#</span>
            <input 
              type="text" 
              id="target-unicast-hex" 
              maxlength="2" 
              placeholder="A4" 
              value="${unicastHex}" 
              style="width: 60px; text-transform: uppercase; font-family: var(--font-mono); font-weight: 800; text-align: center; font-size: 15px; padding: 6px; border-radius: var(--radius-xs); border: 1.5px solid var(--border-strong); color: var(--color-cyan, #0891b2);"
            />
            <span class="text-xs text-secondary">(Recipient's #ID is on their top right pill)</span>
          </div>

          <div class="flex items-center gap-6 mt-8 pt-8" style="border-top: 1px dashed var(--border-line);">
            <span class="text-xs text-secondary font-bold">Quick Demo IDs:</span>
            <button type="button" class="chip chip-unicast-preset font-mono font-bold" data-id="8E">#8E</button>
            <button type="button" class="chip chip-unicast-preset font-mono font-bold" data-id="A4">#A4</button>
            <button type="button" class="chip chip-unicast-preset font-mono font-bold" data-id="42">#42</button>
            <button type="button" class="chip chip-unicast-preset font-mono font-bold" data-id="1B">#1B</button>
          </div>
        </div>
      </div>

      <div id="target-explanation-box" class="text-xs text-secondary p-8" style="background: #ffffff; border-radius: var(--radius-xs); border: 1px solid var(--border-line); line-height: 1.5;">
        ${explanation}
      </div>
    </div>
  `;
}

/** Attach event listeners for Target Destination Selector */
export function bindTargetSelectorEvents(
  container: HTMLElement,
  currentState: TargetSelectorState,
  onChange: (newState: TargetSelectorState, shouldRerender?: boolean) => void
): void {
  const btnBroadcast = container.querySelector('#target-btn-broadcast');
  const btnWall = container.querySelector('#target-btn-wall');
  const btnUnicast = container.querySelector('#target-btn-unicast');
  const inputHex = container.querySelector('#target-unicast-hex') as HTMLInputElement | null;
  const chipPreview = container.querySelector('#auth-target-preview-chip');
  const explanationBox = container.querySelector('#target-explanation-box');
  const btnInstantText = container.querySelector('#auth-btn-text');
  const btnCustomText = container.querySelector('#auth-custom-btn-text');

  btnBroadcast?.addEventListener('click', () => {
    onChange({ targetType: 'broadcast', unicastHex: currentState.unicastHex }, true);
  });

  btnWall?.addEventListener('click', () => {
    onChange({ targetType: 'wall', unicastHex: currentState.unicastHex }, true);
  });

  btnUnicast?.addEventListener('click', () => {
    onChange({ targetType: 'unicast', unicastHex: currentState.unicastHex }, true);
  });

  inputHex?.addEventListener('input', () => {
    const clean = inputHex.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 2);
    inputHex.value = clean;
    const currentHex = clean || 'A4';
    onChange({ targetType: 'unicast', unicastHex: currentHex }, false);

    // Update in-place without losing input focus
    if (chipPreview) {
      chipPreview.textContent = `#${currentHex} · Direct Unicast`;
    }
    if (explanationBox) {
      explanationBox.innerHTML = `<span class="inline-icon" style="display:inline-flex; vertical-align:middle; margin-right:6px; color:var(--color-cyan, #0891b2);">${ICONS.target}</span><strong>Direct Unicast Mode:</strong> Only phone <strong>#${currentHex}</strong> rings, flashes Cyan, and unlocks this message. Intermediate phones forward the sound pulse silently with text masked.`;
    }
    if (btnInstantText) {
      btnInstantText.textContent = `Send Direct Beacon to Phone #${currentHex} (14B • 3x repeats)`;
    }
    if (btnCustomText) {
      btnCustomText.textContent = `Send Direct Chirp to Phone #${currentHex} (14B • ~1.2s airtime)`;
    }
  });

  container.querySelectorAll('.chip-unicast-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id || 'A4';
      if (inputHex) inputHex.value = id;
      onChange({ targetType: 'unicast', unicastHex: id }, true);
    });
  });
}
