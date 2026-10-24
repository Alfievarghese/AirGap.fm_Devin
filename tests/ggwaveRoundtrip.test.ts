import { describe, it, expect } from 'vitest';
import ggwaveFactory from 'ggwave';
import { encodeFrame, decodeFrame, FrameType, BeaconFrame } from '../src/protocol/frame';
import { computeMAC } from '../src/crypto/mac';

describe('Acoustic GGWAVE Physical Frame Roundtrip', () => {
  it('correctly encodes 14-byte frame into float32 audio and decodes back without byte corruption', async () => {
    const ggwave = await ggwaveFactory();
    const inst = ggwave.init(ggwave.getDefaultParameters());

    const frame: BeaconFrame = {
      version: 1,
      type: FrameType.TEMPLATE_ALERT,
      scriptId: 0,
      targetNodeId: 0,
      alertId: 0x4a2f,
      templateId: 1,
      hop: 0,
      ttl: 6,
      mac: new Uint8Array(4),
    };

    const initialEncoded = encodeFrame(frame);
    frame.mac = await computeMAC(initialEncoded.subarray(0, 10));
    const frameBytes = encodeFrame(frame);
    expect(frameBytes.length).toBe(14);

    // 1. Transmit side: Uint8Array passed directly to encode
    const pObj = ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
    const rawWaveform = ggwave.encode(inst, frameBytes, pObj, 50);
    expect(rawWaveform).toBeDefined();

    // Raw bytes converted to Float32Array
    const floatSamples = new Float32Array(
      rawWaveform.buffer,
      rawWaveform.byteOffset,
      rawWaveform.byteLength / 4
    );
    expect(floatSamples.length).toBeGreaterThan(0);

    // 2. Receive side: microphone slices accumulated into 4096
    let micAccumulator = new Float32Array(4096);
    let micAccIdx = 0;
    let decodedBytes: Uint8Array | null = null;

    for (let i = 0; i < floatSamples.length; i += 128) {
      const chunk = floatSamples.subarray(i, i + 128);
      const toCopy = Math.min(chunk.length, 4096 - micAccIdx);
      micAccumulator.set(chunk.subarray(0, toCopy), micAccIdx);
      micAccIdx += toCopy;

      if (micAccIdx >= 4096) {
        const bytesToDecode = new Int8Array(
          micAccumulator.buffer,
          micAccumulator.byteOffset,
          micAccumulator.byteLength
        );
        const res = ggwave.decode(inst, bytesToDecode);
        if (res && res.length > 0) {
          decodedBytes = new Uint8Array(res);
        }
        micAccumulator = new Float32Array(4096);
        micAccIdx = 0;
      }
    }

    expect(decodedBytes).not.toBeNull();
    expect(decodedBytes!.length).toBe(14);
    expect(Array.from(decodedBytes!)).toEqual(Array.from(frameBytes));

    const receivedFrame = decodeFrame(decodedBytes!);
    expect(receivedFrame).not.toBeNull();
    expect(receivedFrame!.templateId).toBe(1);
    expect(receivedFrame!.alertId).toBe(0x4a2f);

    ggwave.free(inst);
  });
});
