/**
 * Live 2D Spectrogram Waterfall for AirGap.fm
 * Visualizes ggwave 96-bin FSK frequency steps (1.8 kHz - 6.3 kHz) in real-time.
 * Satisfies Devin Hacks "Make the Invisible Visible" & "Works Anyway" tracks.
 */

export class SpectrogramWaterfall {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private analyser: AnalyserNode | null = null;
  private animationId: number | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;

  // ggwave audible band parameters
  private readonly minFreq = 1800; // Hz
  private readonly maxFreq = 6300; // Hz
  private readonly fftSize = 1024;

  /** Color palette LUT (Look-Up Table) for fast neon thermal rendering */
  private colorLUT: string[] = [];

  constructor() {
    this.buildColorLUT();
  }

  private buildColorLUT(): void {
    this.colorLUT = new Array(256);
    for (let i = 0; i < 256; i++) {
      if (i < 28) {
        // Noise floor: cosmic deep midnight
        this.colorLUT[i] = '#070a14';
      } else if (i < 70) {
        // Low signal: deep electric indigo to cobalt
        const t = (i - 28) / 42;
        const r = Math.round(15 + t * 25);
        const g = Math.round(25 + t * 75);
        const b = Math.round(60 + t * 140);
        this.colorLUT[i] = `rgb(${r}, ${g}, ${b})`;
      } else if (i < 130) {
        // Medium signal: radiant electric cyan to turquoise
        const t = (i - 70) / 60;
        const r = Math.round(40 - t * 30);
        const g = Math.round(100 + t * 120);
        const b = Math.round(200 + t * 45);
        this.colorLUT[i] = `rgb(${r}, ${g}, ${b})`;
      } else if (i < 190) {
        // Carrier tone: neon emerald to solar amber
        const t = (i - 130) / 60;
        const r = Math.round(10 + t * 235);
        const g = Math.round(220 - t * 40);
        const b = Math.round(180 - t * 165);
        this.colorLUT[i] = `rgb(${r}, ${g}, ${b})`;
      } else {
        // Peak saturation: solar amber to diamond white
        const t = (i - 190) / 66;
        const r = 255;
        const g = Math.round(180 + t * 75);
        const b = Math.round(15 + t * 240);
        this.colorLUT[i] = `rgb(${r}, ${g}, ${b})`;
      }
    }
  }

  start(canvasId: string, analyser: AnalyserNode | null): void {
    this.stop();

    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!this.ctx) return;

    this.analyser = analyser;
    if (this.analyser) {
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.2; // Fast response for FSK tones
      const bufferLength = this.analyser.frequencyBinCount;
      this.freqData = new Uint8Array(bufferLength);
    }

    // Reset canvas to dark
    this.ctx.fillStyle = '#070a14';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderLoop();
  }

  private renderLoop = (): void => {
    this.animationId = requestAnimationFrame(this.renderLoop);
    if (!this.canvas || !this.ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const scrollSpeed = 2; // Pixels per frame

    // 1. Scroll existing waterfall downward
    this.ctx.drawImage(
      this.canvas,
      0, 0, w, h - scrollSpeed,
      0, scrollSpeed, w, h - scrollSpeed
    );

    // 2. Fetch new frequency slice
    if (this.analyser && this.freqData) {
      this.analyser.getByteFrequencyData(this.freqData);

      const sampleRate = this.analyser.context.sampleRate || 48000;
      const binWidth = sampleRate / this.fftSize;

      const minBin = Math.max(0, Math.floor(this.minFreq / binWidth));
      const maxBin = Math.min(this.freqData.length - 1, Math.ceil(this.maxFreq / binWidth));
      const totalBins = maxBin - minBin;

      const binPixelWidth = w / totalBins;

      for (let i = 0; i < totalBins; i++) {
        const binIndex = minBin + i;
        const energy = this.freqData[binIndex] || 0;
        this.ctx.fillStyle = this.colorLUT[energy] || '#06080e';
        this.ctx.fillRect(
          Math.floor(i * binPixelWidth),
          0,
          Math.ceil(binPixelWidth),
          scrollSpeed
        );
      }
    } else {
      // Idle clean optical bezel slice with subtle ambient floor
      const ambientEnergy = Math.floor(Math.random() * 8);
      this.ctx.fillStyle = this.colorLUT[ambientEnergy] || '#0b0f19';
      this.ctx.fillRect(0, 0, w, scrollSpeed);
    }
  };

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

export const spectrogram = new SpectrogramWaterfall();
