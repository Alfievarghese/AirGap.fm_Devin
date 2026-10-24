/**
 * Discrete event simulator for relay network.
 * No real audio — simulates frame propagation with positions, range, loss, noise.
 * Deterministic with seed for reproducible tests.
 */

import {
  BeaconFrame,
  encodeFrame,
  FrameType,
  FRAME_VERSION,
} from '../protocol/frame';
import { computeMAC } from '../crypto/mac';
import { getImmutableBytes, getTimeBucket } from '../protocol/frame';
import { RelayConfig, DEFAULT_CONFIG, randFloat } from '../lib/config';

/** Seeded PRNG (xoshiro128**) for reproducibility */
export class SeededRNG {
  private s: Uint32Array;

  constructor(seed: number) {
    this.s = new Uint32Array(4);
    // SplitMix32 for seed expansion
    let z = seed | 0;
    for (let i = 0; i < 4; i++) {
      z = (z + 0x9e3779b9) | 0;
      let t = z ^ (z >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      t = t ^ (t >>> 15);
      this.s[i] = t >>> 0;
    }
  }

  next(): number {
    const s = this.s;
    const result = (Math.imul(s[1] * 5, 1 << 7 | 1) >>> 0) / 4294967296;
    const t = s[1] << 9;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = (s[3] << 11 | s[3] >>> 21) >>> 0;
    return result;
  }

  /** Random float in [min, max) */
  range(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Random boolean with probability p */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export interface SimNode {
  id: number;
  x: number;
  y: number;
  /** Has this node received the alert? */
  reached: boolean;
  /** Total transmissions by this node */
  txCount: number;
  /** Hop count at which alert was received */
  hopReceived: number;
  /** Time (sim ticks) at which alert was received */
  timeReceived: number;
  /** Dedupe: alerts heard */
  heardCount: number;
}

interface SimEvent {
  time: number;
  type: 'transmit' | 'receive';
  nodeId: number;
  frame: BeaconFrame;
}

export interface SimResult {
  totalNodes: number;
  reachedNodes: number;
  coveragePercent: number;
  maxHop: number;
  totalTransmissions: number;
  avgTxPerNode: number;
  maxTxPerNode: number;
  timeToLastNode: number;
  nodes: SimNode[];
  events: SimEvent[];
}

export interface SimConfig {
  nodeCount: number;
  roomWidth: number;
  roomHeight: number;
  range: number;
  frameLossRate: number;
  seed: number;
  relayConfig: Partial<RelayConfig>;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  nodeCount: 50,
  roomWidth: 10,
  roomHeight: 10,
  range: 4,
  frameLossRate: 0.3,
  seed: 42,
  relayConfig: {},
};

/**
 * Run a simulation. Returns synchronously (no real timers).
 */
export async function runSimulation(
  simConfig: Partial<SimConfig> = {}
): Promise<SimResult> {
  const cfg: SimConfig = { ...DEFAULT_SIM_CONFIG, ...simConfig };
  const relay: RelayConfig = { ...DEFAULT_CONFIG, ...cfg.relayConfig };
  const rng = new SeededRNG(cfg.seed);

  // Place nodes randomly
  const nodes: SimNode[] = [];
  for (let i = 0; i < cfg.nodeCount; i++) {
    nodes.push({
      id: i,
      x: rng.range(0, cfg.roomWidth),
      y: rng.range(0, cfg.roomHeight),
      reached: false,
      txCount: 0,
      hopReceived: -1,
      timeReceived: -1,
      heardCount: 0,
    });
  }

  const events: SimEvent[] = [];
  const eventQueue: SimEvent[] = [];
  let simTime = 0;

  // Build adjacency: who can hear who
  function inRange(a: SimNode, b: SimNode): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) <= cfg.range;
  }

  // Create origin beacon from node 0 (Authority)
  const alertId = 0x1234;
  const templateId = 0x01;
  const originFrame: BeaconFrame = {
    version: FRAME_VERSION,
    type: FrameType.BEACON,
    targetNodeId: 0x00,
    alertId,
    templateId,
    regionCode: 0,
    params: new Uint8Array([0, 0, 0]),
    originTimeBucket: 0,
    hop: 0,
    ttl: relay.ttl,
    mac: new Uint8Array(8), // will compute
  };

  // Compute MAC
  const encoded = encodeFrame(originFrame);
  const immutable = getImmutableBytes(encoded);
  originFrame.mac = await computeMAC(immutable);

  // Dedupe per node: key → heardCount
  const nodeDedupeCount = new Map<number, number>();
  const nodeTxCount = new Map<number, number>();

  // Seed: Authority (node 0) transmits
  nodes[0].reached = true;
  nodes[0].hopReceived = 0;
  nodes[0].timeReceived = 0;

  // Authority repeats
  for (let r = 0; r < relay.authorityRepeatCount; r++) {
    eventQueue.push({
      time: r * 3500, // ~3.5s spacing
      type: 'transmit',
      nodeId: 0,
      frame: { ...originFrame },
    });
    nodes[0].txCount++;
  }

  // Process events
  eventQueue.sort((a, b) => a.time - b.time);

  const MAX_EVENTS = 10000;
  let processed = 0;

  while (eventQueue.length > 0 && processed < MAX_EVENTS) {
    const event = eventQueue.shift()!;
    simTime = event.time;
    events.push(event);
    processed++;

    if (event.type === 'transmit') {
      const sender = nodes[event.nodeId];

      // Propagate to all nodes in range
      for (const receiver of nodes) {
        if (receiver.id === sender.id) continue;
        if (!inRange(sender, receiver)) continue;

        // Frame loss
        if (rng.chance(cfg.frameLossRate)) continue;

        // Schedule receive
        const propDelay = 10; // ~10ms propagation
        eventQueue.push({
          time: simTime + propDelay,
          type: 'receive',
          nodeId: receiver.id,
          frame: { ...event.frame },
        });
      }
    } else if (event.type === 'receive') {
      const node = nodes[event.nodeId];
      node.heardCount++;

      const heardKey = event.nodeId;
      const prevCount = nodeDedupeCount.get(heardKey) ?? 0;
      nodeDedupeCount.set(heardKey, prevCount + 1);

      if (!node.reached) {
        node.reached = true;
        node.hopReceived = event.frame.hop;
        node.timeReceived = simTime;
      }

      // Trickle suppression: if already heard k copies, don't relay
      if (prevCount + 1 >= relay.k) continue;

      // TTL check
      if (event.frame.hop >= event.frame.ttl) continue;

      // Max retransmit check
      const prevTx = nodeTxCount.get(event.nodeId) ?? 0;
      if (prevTx >= relay.maxRetransmit) continue;

      // Schedule relay with jitter
      const listenDelay = rng.range(
        relay.listenWindow[0],
        relay.listenWindow[1]
      );
      const trickleDelay = rng.range(
        relay.iMin / 2,
        relay.iMin
      );

      const relayFrame: BeaconFrame = {
        ...event.frame,
        hop: event.frame.hop + 1,
      };

      nodeTxCount.set(event.nodeId, prevTx + 1);
      node.txCount++;

      eventQueue.push({
        time: simTime + listenDelay + trickleDelay,
        type: 'transmit',
        nodeId: event.nodeId,
        frame: relayFrame,
      });

      // Re-sort
      eventQueue.sort((a, b) => a.time - b.time);
    }
  }

  // Compute results
  const reachedNodes = nodes.filter((n) => n.reached).length;
  const txCounts = nodes.map((n) => n.txCount);
  const totalTx = txCounts.reduce((a, b) => a + b, 0);
  const maxTx = Math.max(...txCounts);
  const avgTx = totalTx / cfg.nodeCount;
  const maxHop = Math.max(...nodes.filter((n) => n.reached).map((n) => n.hopReceived));
  const lastNodeTime = Math.max(
    ...nodes.filter((n) => n.reached).map((n) => n.timeReceived)
  );

  return {
    totalNodes: cfg.nodeCount,
    reachedNodes,
    coveragePercent: (reachedNodes / cfg.nodeCount) * 100,
    maxHop,
    totalTransmissions: totalTx,
    avgTxPerNode: avgTx,
    maxTxPerNode: maxTx,
    timeToLastNode: lastNodeTime,
    nodes,
    events,
  };
}
