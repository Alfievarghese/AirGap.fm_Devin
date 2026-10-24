/**
 * Audio engine: ggwave integration, AudioContext management, mic capture,
 * half-duplex state machine, carrier sense, iOS workarounds.
 *
 * State machine: IDLE → LISTEN → TX → COOLDOWN → LISTEN
 */

import type { RelayConfig } from '../lib/config';
import { DEFAULT_CONFIG, randRange } from '../lib/config';

export type AudioState = 'IDLE' | 'LISTEN' | 'TX' | 'COOLDOWN';

export interface AudioEngineCallbacks {
  onDecode: (data: Uint8Array) => void;
  onStateChange: (state: AudioState) => void;
  onError: (msg: string) => void;
  onLevelChange?: (level: number) => void;
}

interface GGWaveModule {
  init: (params: unknown) => number;
  free: (instance: number) => void;
  encode: (
    instance: number,
    payload: string | Uint8Array,
    protocolId: number,
    volume: number
  ) => Float32Array;
  decode: (instance: number, samples: Float32Array) => Uint8Array | null;
  getDefaultParameters: () => Record<string, unknown>;
  ProtocolId: Record<string, number>;
  TxProtocolId?: Record<string, number>;
}

let ggwaveModule: GGWaveModule | null = null;
let ggwaveInstance: number = -1;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private state: AudioState = 'IDLE';
  private callbacks: AudioEngineCallbacks;
  private config: RelayConfig;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private silentAudio: HTMLAudioElement | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private analyserNode: AnalyserNode | null = null;
  private levelInterval: ReturnType<typeof setInterval> | null = null;

  constructor(callbacks: AudioEngineCallbacks, config?: Partial<RelayConfig>) {
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): AudioState {
    return this.state;
  }

  private setState(s: AudioState): void {
    this.state = s;
    this.callbacks.onStateChange(s);
  }

  /**
   * Initialize ggwave WASM and AudioContext.
   * MUST be called from a user gesture (tap/click) handler.
   */
  async init(): Promise<void> {
    // 1. Load ggwave
    if (!ggwaveModule) {
      try {
        const factory = (await import('ggwave')).default;
        ggwaveModule = await factory();
      } catch (e) {
        this.callbacks.onError(`ggwave load failed: ${e}`);
        throw e;
      }
    }

    // 2. Init ggwave instance
    if (ggwaveInstance < 0 && ggwaveModule) {
      const params = ggwaveModule.getDefaultParameters();
      // Set sample rate if AudioContext exists
      if (this.ctx) {
        (params as Record<string, unknown>)['sampleRateInp'] = this.ctx.sampleRate;
        (params as Record<string, unknown>)['sampleRateOut'] = this.ctx.sampleRate;
      }
      ggwaveInstance = ggwaveModule.init(params);
    }

    // 3. iOS ringer workaround: play silent <audio> element
    this.unlockIOSAudio();

    // 4. Create AudioContext
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)({
        sampleRate: this.config.sampleRate,
      });
    }

    // Resume if suspended
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Read actual sample rate (iOS may force 44100)
    const actualRate = this.ctx.sampleRate;
    if (actualRate !== this.config.sampleRate) {
      console.warn(
        `Requested ${this.config.sampleRate} Hz, got ${actualRate} Hz`
      );
      // Re-init ggwave with actual rate
      if (ggwaveModule && ggwaveInstance >= 0) {
        ggwaveModule.free(ggwaveInstance);
        const params = ggwaveModule.getDefaultParameters();
        (params as Record<string, unknown>)['sampleRateInp'] = actualRate;
        (params as Record<string, unknown>)['sampleRateOut'] = actualRate;
        ggwaveInstance = ggwaveModule.init(params);
      }
    }

    // 5. Request wake lock
    await this.requestWakeLock();

    // 6. audioSession hint for iOS
    if ('audioSession' in navigator) {
      try {
        (navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'playback';
      } catch { /* ignore */ }
    }

    this.setState('IDLE');
  }

  /**
   * Start listening on the microphone.
   */
  async startListening(): Promise<void> {
    if (!this.ctx || !ggwaveModule || ggwaveInstance < 0) {
      throw new Error('Call init() first');
    }

    if (this.state === 'LISTEN') return;

    // Request mic
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: this.ctx.sampleRate,
        },
      });
    } catch (e) {
      const err = e as Error;
      if (err.name === 'NotAllowedError') {
        this.callbacks.onError(
          'Mic permission denied. Grant mic access to use AirGap.fm.'
        );
      } else {
        this.callbacks.onError(`Mic error: ${err.message}`);
      }
      throw e;
    }

    // Check constraints actually applied
    const track = this.micStream.getAudioTracks()[0];
    if (track) {
      const settings = track.getSettings();
      const warnings: string[] = [];
      if (settings.echoCancellation) warnings.push('echoCancellation ON');
      if (settings.noiseSuppression) warnings.push('noiseSuppression ON');
      if (settings.autoGainControl) warnings.push('autoGainControl ON');
      if (warnings.length > 0) {
        console.warn('Mic constraints ignored by browser:', warnings.join(', '));
      }
    }

    // Connect mic → processor
    this.sourceNode = this.ctx.createMediaStreamSource(this.micStream);

    // Analyser for level meter
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.sourceNode.connect(this.analyserNode);

    // Start level reporting
    if (this.callbacks.onLevelChange) {
      const analyser = this.analyserNode;
      const bufLen = analyser.frequencyBinCount;
      const dataArr = new Float32Array(bufLen);
      this.levelInterval = setInterval(() => {
        analyser.getFloatTimeDomainData(dataArr);
        let sum = 0;
        for (let i = 0; i < bufLen; i++) {
          sum += dataArr[i] * dataArr[i];
        }
        const rms = Math.sqrt(sum / bufLen);
        this.callbacks.onLevelChange?.(rms);
      }, 100);
    }

    // AudioWorklet with ScriptProcessor fallback
    let workletInitialized = false;
    if (typeof AudioWorkletNode !== 'undefined' && this.ctx.audioWorklet) {
      try {
        const workletCode = `
          class GgwaveCaptureProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0];
              if (input && input[0]) {
                this.port.postMessage(input[0]);
              }
              return true;
            }
          }
          registerProcessor('ggwave-capture-processor', GgwaveCaptureProcessor);
        `;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        await this.ctx.audioWorklet.addModule(blobUrl);
        URL.revokeObjectURL(blobUrl);

        const workletNode = new AudioWorkletNode(this.ctx, 'ggwave-capture-processor');
        workletNode.port.onmessage = (e) => {
          if (this.state !== 'LISTEN' || !ggwaveModule || ggwaveInstance < 0) return;
          const samples = e.data as Float32Array;
          const result = ggwaveModule.decode(ggwaveInstance, samples);
          if (result && result.length > 0) {
            this.callbacks.onDecode(new Uint8Array(result));
          }
        };

        this.sourceNode.connect(workletNode);
        workletNode.connect(this.ctx.destination);
        workletInitialized = true;
      } catch (e) {
        console.warn('AudioWorklet init failed, falling back to ScriptProcessor:', e);
      }
    }

    if (!workletInitialized) {
      // ScriptProcessorNode fallback
      const bufSize = 4096;
      this.processorNode = this.ctx.createScriptProcessor(bufSize, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (this.state !== 'LISTEN') return;
        if (!ggwaveModule || ggwaveInstance < 0) return;

        const samples = e.inputBuffer.getChannelData(0);
        const result = ggwaveModule.decode(
          ggwaveInstance,
          new Float32Array(samples)
        );

        if (result && result.length > 0) {
          this.callbacks.onDecode(new Uint8Array(result));
        }

        // Pass through silence
        const output = e.outputBuffer.getChannelData(0);
        output.fill(0);
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.ctx.destination);
    }

    this.setState('LISTEN');
  }

  private lastTxTimestamp = 0;

  /**
   * Transmit a payload via ggwave audio.
   * Enforces carrier sense backoff, duty cycle cap, switches to TX, plays audio, enters COOLDOWN.
   */
  async transmit(payload: Uint8Array | string): Promise<void> {
    if (!this.ctx || !ggwaveModule || ggwaveInstance < 0) {
      throw new Error('Not initialized');
    }

    if (this.state === 'TX') {
      console.warn('Already transmitting, ignoring');
      return;
    }

    // 1. Enforce node duty cycle cap (at most 1 transmission per 4 seconds)
    const timeSinceLast = Date.now() - this.lastTxTimestamp;
    if (this.lastTxTimestamp > 0 && timeSinceLast < this.config.dutyCycleMs) {
      const waitMs = this.config.dutyCycleMs - timeSinceLast;
      await new Promise((r) => setTimeout(r, waitMs));
    }

    // 2. Carrier sense: check band energy, back off if busy (up to carrierSenseMaxRetries)
    if (this.analyserNode) {
      let attempts = 0;
      const bufLen = this.analyserNode.frequencyBinCount;
      const timeData = new Float32Array(bufLen);

      while (attempts < this.config.carrierSenseMaxRetries) {
        this.analyserNode.getFloatTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < bufLen; i++) sum += timeData[i] * timeData[i];
        const rms = Math.sqrt(sum / bufLen);

        if (rms > this.config.carrierSenseThreshold) {
          attempts++;
          const [bMin, bMax] = this.config.carrierSenseBackoff;
          const backoff = bMin + Math.random() * (bMax - bMin);
          await new Promise((r) => setTimeout(r, backoff));
        } else {
          break;
        }
      }

      if (attempts >= this.config.carrierSenseMaxRetries) {
        this.callbacks.onError('Carrier sense busy: channel occupied after 5 backoff tries');
        return;
      }
    }

    this.lastTxTimestamp = Date.now();
    const prevState = this.state;
    this.setState('TX');

    // Resolve protocol ID
    const protocolIds = ggwaveModule.ProtocolId || ggwaveModule.TxProtocolId;
    const protocolId = protocolIds?.[this.config.ggwaveProtocol] ?? 1;

    // Encode audio
    const waveform = ggwaveModule.encode(
      ggwaveInstance,
      payload as string,
      protocolId,
      this.config.ggwaveVolume
    );

    if (!waveform || waveform.length === 0) {
      this.callbacks.onError('ggwave encode returned empty waveform');
      this.setState(prevState);
      return;
    }

    // Play waveform with smooth attack and decay envelope to prevent harsh speaker clipping
    const buffer = this.ctx.createBuffer(1, waveform.length, this.ctx.sampleRate);
    buffer.getChannelData(0).set(waveform);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const duration = waveform.length / this.ctx.sampleRate;

    // Smooth 15ms fade-in and 25ms fade-out
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(1.0, now + 0.015);
    gainNode.gain.setValueAtTime(1.0, now + Math.max(0.015, duration - 0.025));
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    source.start(now);

    // Wait for playback to finish, then cooldown
    const durationMs = (waveform.length / this.ctx.sampleRate) * 1000;

    return new Promise((resolve) => {
      source.onended = () => {
        this.setState('COOLDOWN');
        this.cooldownTimer = setTimeout(() => {
          this.cooldownTimer = null;
          this.setState('LISTEN');
          resolve();
        }, this.config.txCooldownMs);
      };

      // Fallback timeout in case onended doesn't fire
      setTimeout(() => {
        if (this.state === 'TX') {
          this.setState('COOLDOWN');
          this.cooldownTimer = setTimeout(() => {
            this.cooldownTimer = null;
            this.setState('LISTEN');
            resolve();
          }, this.config.txCooldownMs);
        }
      }, durationMs + 500);
    });
  }

  /**
   * Transmit raw bytes (for relay: frame bytes as binary).
   * ggwave's encode expects string, so we pass raw bytes as a string.
   */
  async transmitBytes(payload: Uint8Array): Promise<void> {
    // ggwave encode takes a string — convert bytes to a string representation
    // that ggwave can handle. Since ggwave operates on raw bytes internally,
    // we pass the bytes as a Latin-1 string (each byte maps to a char).
    const str = Array.from(payload)
      .map((b) => String.fromCharCode(b))
      .join('');
    return this.transmit(str);
  }

  /** Play a test tone (1 kHz, 500ms) to verify speaker output */
  async playTestTone(): Promise<void> {
    if (!this.ctx) {
      this.callbacks.onError('AudioContext not initialized');
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = 1000;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
    }, 500);
  }

  /** Play a pleasant two-tone arrival chime (D5 -> A5) when unicast destination is reached */
  async playArrivalChime(): Promise<void> {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.0, now + 0.15); // A5
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
      setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
      }, 550);
    } catch {
      /* ignore audio context restrictions */
    }
  }

  /** Get current audio level (RMS) from analyser */
  getLevel(): number {
    if (!this.analyserNode) return 0;
    const bufLen = this.analyserNode.frequencyBinCount;
    const data = new Float32Array(bufLen);
    this.analyserNode.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < bufLen; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / bufLen);
  }

  /** Get mic constraint verification results */
  getMicSettings(): MediaTrackSettings | null {
    if (!this.micStream) return null;
    const track = this.micStream.getAudioTracks()[0];
    return track ? track.getSettings() : null;
  }

  /** Get actual sample rate */
  getSampleRate(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  /** Get analyser node for live UI visualization */
  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /** Get available ggwave protocol names */
  getProtocolNames(): string[] {
    if (!ggwaveModule) return [];
    const ids = ggwaveModule.ProtocolId || ggwaveModule.TxProtocolId || {};
    return Object.keys(ids);
  }

  /** iOS silent audio workaround */
  private unlockIOSAudio(): void {
    if (this.silentAudio) return;

    // Tiny silent MP3 base64
    const silentSrc =
      'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjgzLjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU3LjEwAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwBHAAAAAAD/+1DEAAAC4ANX9AAABPgAa/4wAABGSihmCjBRg0qCAIORAgDI6ePaBAEPwfB8HwfB8EAQBA5//y4Pg+D4Pg+D4IAgCAIHJ///B8HwfB8HwfBAEAQBACB///8HwfB8HwfB8EAQBA5/4Pg+D4Pg+D4Pg+D4Pg//g+D4Pg+D4Pg+D4PggAABn/+1DEKAAFkANX+YEAAPgAa/8wIAAAADSJZJlMk0CiSRQAAAAEkihLB7+sS0GWTLJI//WJZMpkiwAAACWSLBkj3/6xLQJZMskWCf/1iWg0yZTJNgAAABLJFg9/+sS0GmTKZJsE//rEtAllyyRYAAAJZIsGSP/+sS0CWTKZIsE//WJaDLJlMk2AAAAEskWD3/6xLQJZMskigT/+sS0=';

    this.silentAudio = document.createElement('audio');
    this.silentAudio.src = silentSrc;
    this.silentAudio.loop = true;
    this.silentAudio.volume = 0.01;
    this.silentAudio.setAttribute('playsinline', '');
    this.silentAudio.play().catch(() => {
      // May fail if not in gesture — that's OK, will retry
    });
  }

  /** Request Screen Wake Lock */
  private async requestWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
    } catch (e) {
      console.warn('Wake lock failed:', e);
    }

    // Re-acquire on visibility change
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && !this.wakeLock) {
        try {
          this.wakeLock = await navigator.wakeLock.request('screen');
        } catch { /* ignore */ }
      }
    });
  }

  /** Stop and cleanup */
  destroy(): void {
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    if (this.levelInterval) clearInterval(this.levelInterval);

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.silentAudio) {
      this.silentAudio.pause();
      this.silentAudio = null;
    }
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    if (ggwaveModule && ggwaveInstance >= 0) {
      ggwaveModule.free(ggwaveInstance);
      ggwaveInstance = -1;
    }

    this.setState('IDLE');
  }
}
