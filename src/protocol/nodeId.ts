/**
 * 1-Byte Node Identity & Targeted Device Addressing for AirGap.fm.
 *
 * Special reserved addresses:
 * - 0x00: ROOM BROADCAST (all devices receive, display, and relay)
 * - 0xFF: PROJECTOR WALL (sink display node)
 * - 0x01..0xFE: UNICAST NODES (routed hop-by-hop; intermediate nodes forward silently, destination node unlocks payload)
 */

export const NODE_ID_BROADCAST = 0x00;
export const NODE_ID_WALL = 0xff;

const STORAGE_KEY = 'airgap_node_id';

/** Get the persistent local device node ID (0x01..0xFE) */
export function getLocalNodeId(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 16);
      if (!isNaN(parsed) && parsed >= 0x01 && parsed <= 0xfe) {
        return parsed;
      }
    }
  } catch {
    // LocalStorage unavailable in certain iframe sandboxes
  }

  // Generate random persistent 1-byte ID (0x01..0xFE)
  const randomId = Math.floor(Math.random() * 254) + 1;
  setLocalNodeId(randomId);
  return randomId;
}

/** Set and persist the local device node ID */
export function setLocalNodeId(id: number): boolean {
  if (id < 0x01 || id > 0xfe) return false;
  try {
    localStorage.setItem(STORAGE_KEY, id.toString(16).padStart(2, '0').toUpperCase());
  } catch {
    /* ignore */
  }
  return true;
}

/** Format a node ID for display */
export function formatNodeId(id: number): string {
  if (id === NODE_ID_BROADCAST) return 'Broadcast (All)';
  if (id === NODE_ID_WALL) return 'Projector Wall (#FF)';
  return `#${id.toString(16).padStart(2, '0').toUpperCase()}`;
}

/** Format as short 2-character hex */
export function toHexId(id: number): string {
  return id.toString(16).padStart(2, '0').toUpperCase();
}

/** Parse a hex input string to node ID */
export function parseNodeId(hexStr: string): number | null {
  const clean = hexStr.replace(/^#/, '').trim();
  const parsed = parseInt(clean, 16);
  if (isNaN(parsed) || parsed < 0 || parsed > 0xff) return null;
  return parsed;
}
