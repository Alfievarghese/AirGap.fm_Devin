/**
 * Authority UI Target Selector Component (`src/ui/authority.ts`).
 * Compact toggle selector for targeted device routing:
 * - [ Broadcast (All) ] (0x00 - default)
 * - [ Projector Wall (#FF) ] (0xFF)
 * - [ Specific Node (#__) ] (2-character Hex input, e.g. A4)
 */

import { NODE_ID_BROADCAST, NODE_ID_WALL, parseNodeId, toHexId } from '../protocol/nodeId';

export type TargetType = 'broadcast' | 'wall' | 'custom';

export interface TargetSelectorState {
  targetType: TargetType;
  customHex: string;
}

/** Resolve numerical 1-byte targetNodeId from selector state */
export function resolveTargetNodeId(targetType: TargetType, customHex: string): number {
  if (targetType === 'broadcast') return NODE_ID_BROADCAST;
  if (targetType === 'wall') return NODE_ID_WALL;
  const parsed = parseNodeId(customHex);
  if (parsed !== null && parsed >= 0x01 && parsed <= 0xfe) {
    return parsed;
  }
  return NODE_ID_BROADCAST;
}

/** Render the HTML template for the Target Selector */
export function renderTargetSelector(targetType: TargetType, customHex: string): string {
  const targetId = resolveTargetNodeId(targetType, customHex);
  const targetLabel =
    targetType === 'broadcast'
      ? '0x00 · Broadcast (All)'
      : targetType === 'wall'
      ? '0xFF · Projector Wall'
      : `#${toHexId(targetId)} · Direct Unicast`;

  return `
    <div class="target-selector-card p-12 mb-12" style="background: var(--bg-inset); border-radius: var(--radius-md); border: 1.5px solid var(--border-card);">
      <div class="flex justify-between items-center mb-8">
        <label class="text-xs text-secondary font-bold uppercase tracking-wider">Acoustic Routing Target</label>
        <span class="chip chip-sm font-mono ${targetType === 'custom' ? 'text-cyan' : 'text-primary'}" id="auth-target-preview-chip">
          ${targetLabel}
        </span>
      </div>

      <div class="flex gap-6 mb-8 target-toggle-group">
        <button type="button" class="btn ${targetType === 'broadcast' ? 'btn-primary' : 'btn-outline'} flex-1" id="target-btn-broadcast">
          Broadcast (All)
        </button>
        <button type="button" class="btn ${targetType === 'wall' ? 'btn-primary' : 'btn-outline'} flex-1" id="target-btn-wall">
          Projector Wall (#FF)
        </button>
        <button type="button" class="btn ${targetType === 'custom' ? 'btn-primary' : 'btn-outline'} flex-1" id="target-btn-custom">
          Specific Node (#__)
        </button>
      </div>

      <div id="target-custom-input-box" style="${targetType === 'custom' ? '' : 'display: none;'}">
        <div class="flex items-center gap-8 p-8" style="background: #ffffff; border-radius: var(--radius-sm); border: 1px solid var(--border-line);">
          <span class="text-xs font-mono font-bold text-secondary">TARGET NODE:</span>
          <span class="font-mono text-primary font-bold" style="font-size: 15px;">#</span>
          <input 
            type="text" 
            id="target-custom-hex" 
            maxlength="2" 
            placeholder="A4" 
            value="${customHex}" 
            style="width: 56px; text-transform: uppercase; font-family: var(--font-mono); font-weight: 800; text-align: center; font-size: 14px; padding: 6px; border-radius: var(--radius-xs); border: 1.5px solid var(--border-strong);"
          />
          <span class="text-xs text-secondary">Direct acoustic packet hops silently across intermediate phones to reach #${customHex || '??'}</span>
        </div>
      </div>
    </div>
  `;
}

/** Attach event listeners for Target Selector */
export function bindTargetSelectorEvents(
  container: HTMLElement,
  currentState: TargetSelectorState,
  onChange: (newState: TargetSelectorState) => void
): void {
  const btnBroadcast = container.querySelector('#target-btn-broadcast');
  const btnWall = container.querySelector('#target-btn-wall');
  const btnCustom = container.querySelector('#target-btn-custom');
  const inputHex = container.querySelector('#target-custom-hex') as HTMLInputElement | null;

  btnBroadcast?.addEventListener('click', () => {
    onChange({ targetType: 'broadcast', customHex: currentState.customHex });
  });

  btnWall?.addEventListener('click', () => {
    onChange({ targetType: 'wall', customHex: currentState.customHex });
  });

  btnCustom?.addEventListener('click', () => {
    onChange({ targetType: 'custom', customHex: currentState.customHex });
  });

  inputHex?.addEventListener('input', () => {
    const clean = inputHex.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 2);
    inputHex.value = clean;
    onChange({ targetType: 'custom', customHex: clean || 'A4' });
  });
}
