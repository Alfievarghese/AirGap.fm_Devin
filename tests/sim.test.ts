/**
 * Simulator tests: coverage, transmissions per node, hop count.
 */
import { describe, it, expect } from 'vitest';
import { runSimulation, SeededRNG } from '../src/relay/sim';

describe('SeededRNG', () => {
  it('produces deterministic output', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const vals1 = Array.from({ length: 10 }, () => rng1.next());
    const vals2 = Array.from({ length: 10 }, () => rng2.next());
    expect(vals1).toEqual(vals2);
  });

  it('produces values in [0, 1)', () => {
    const rng = new SeededRNG(123);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('Simulation', () => {
  it('reaches at least 95% coverage with 50 nodes, 10x10m, range 4m, 30% loss', async () => {
    const result = await runSimulation({
      nodeCount: 50,
      roomWidth: 10,
      roomHeight: 10,
      range: 4,
      frameLossRate: 0.3,
      seed: 42,
    });

    console.log('Coverage:', result.coveragePercent.toFixed(1), '%');
    console.log('Max hop:', result.maxHop);
    console.log('Total TX:', result.totalTransmissions);
    console.log('Avg TX/node:', result.avgTxPerNode.toFixed(2));
    console.log('Max TX/node:', result.maxTxPerNode);
    console.log('Time to last node:', result.timeToLastNode, 'ms (sim)');

    expect(result.coveragePercent).toBeGreaterThanOrEqual(95);
  });

  it('limits transmissions per node to maxRetransmit', async () => {
    const result = await runSimulation({
      nodeCount: 50,
      roomWidth: 10,
      roomHeight: 10,
      range: 4,
      frameLossRate: 0.3,
      seed: 42,
      relayConfig: { maxRetransmit: 3 },
    });

    // Authority transmits authorityRepeatCount (3) times extra
    // Other nodes: at most maxRetransmit = 3
    for (const node of result.nodes) {
      if (node.id === 0) continue; // Authority
      expect(node.txCount).toBeLessThanOrEqual(3);
    }
  });

  it('respects TTL', async () => {
    const result = await runSimulation({
      nodeCount: 20,
      roomWidth: 20,
      roomHeight: 20,
      range: 3,
      frameLossRate: 0,
      seed: 99,
      relayConfig: { ttl: 3 },
    });

    for (const node of result.nodes) {
      if (node.reached && node.id !== 0) {
        expect(node.hopReceived).toBeLessThanOrEqual(3);
      }
    }
  });

  it('handles high loss gracefully', async () => {
    const result = await runSimulation({
      nodeCount: 30,
      roomWidth: 10,
      roomHeight: 10,
      range: 4,
      frameLossRate: 0.8,
      seed: 42,
    });

    // With 80% loss, coverage will be lower but shouldn't crash
    expect(result.reachedNodes).toBeGreaterThanOrEqual(1); // At least authority
    expect(result.totalNodes).toBe(30);
  });
});
