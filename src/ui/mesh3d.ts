/**
 * Interactive 3D Acoustic Mesh Visualizer
 * Renders a rotating, audio-reactive 3D node sphere with geodesic links
 * and dynamic acoustic particle waves in pure Canvas WebGL/Vector Math.
 */

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  speed: number;
}

export class AcousticMesh3D {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private analyser: AnalyserNode | null = null;
  private animationId: number | null = null;
  private nodes: Point3D[] = [];
  private edges: [number, number][] = [];
  private rotX = 0.2;
  private rotY = 0;
  private targetRotX = 0.2;
  private targetRotY = 0;
  private isInteracting = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private freqArray: Uint8Array<ArrayBuffer> | null = null;
  private pulseEnergy = 0;
  private shockwaves: { radius: number; maxRadius: number; opacity: number; color: string }[] = [];

  constructor() {
    this.initGeometry();
  }

  /** Generate an aesthetic 3D Fibonacci sphere topology */
  private initGeometry(): void {
    const nodeCount = 54;
    const radius = 105;
    this.nodes = [];
    this.edges = [];

    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < nodeCount; i++) {
      const y = 1 - (i / (nodeCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      this.nodes.push({
        x: x * radius,
        y: y * radius,
        z: z * radius,
        baseX: x * radius,
        baseY: y * radius,
        baseZ: z * radius,
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.03,
      });
    }

    // Connect close neighbors to create geodesic mesh triangles
    const maxDistSq = 62 * 62;
    for (let i = 0; i < this.nodes.length; i++) {
      let connections = 0;
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[i].baseX - this.nodes[j].baseX;
        const dy = this.nodes[i].baseY - this.nodes[j].baseY;
        const dz = this.nodes[i].baseZ - this.nodes[j].baseZ;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < maxDistSq && connections < 4) {
          this.edges.push([i, j]);
          connections++;
        }
      }
    }
  }

  start(canvasId: string, analyser: AnalyserNode | null): void {
    this.stop();
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;

    this.analyser = analyser;
    if (this.analyser) {
      this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    this.attachEvents();
    this.renderLoop();
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  triggerPulse(type: 'cyan' | 'coral' | 'emerald'): void {
    const colors = {
      cyan: 'rgba(37, 99, 235,',
      coral: 'rgba(240, 62, 24,',
      emerald: 'rgba(5, 122, 85,',
    };
    this.pulseEnergy = 1.0;
    this.shockwaves.push({
      radius: 20,
      maxRadius: 180,
      opacity: 0.9,
      color: colors[type] || colors.cyan,
    });
  }

  triggerShockwave(_color = '#057a55'): void {
    this.pulseEnergy = 1.0;
    this.shockwaves.push({
      radius: 20,
      maxRadius: 180,
      opacity: 0.9,
      color: 'rgba(5, 122, 85,',
    });
  }

  private attachEvents(): void {
    if (!this.canvas) return;

    const onPointerDown = (clientX: number, clientY: number) => {
      this.isInteracting = true;
      this.lastMouseX = clientX;
      this.lastMouseY = clientY;
    };

    const onPointerMove = (clientX: number, clientY: number) => {
      if (!this.isInteracting) {
        const rect = this.canvas!.getBoundingClientRect();
        const nx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const ny = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        this.targetRotY += nx * 0.015;
        this.targetRotX += ny * 0.015;
        return;
      }

      const dx = clientX - this.lastMouseX;
      const dy = clientY - this.lastMouseY;
      this.targetRotY += dx * 0.008;
      this.targetRotX += dy * 0.008;
      this.lastMouseX = clientX;
      this.lastMouseY = clientY;
    };

    const onPointerUp = () => {
      this.isInteracting = false;
    };

    this.canvas.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', onPointerUp);
  }

  private renderLoop = (): void => {
    this.animationId = requestAnimationFrame(this.renderLoop);
    if (!this.canvas || !this.ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    this.ctx.clearRect(0, 0, width, height);

    // Read real-time audio FFT energy
    let audioLevel = 0;
    if (this.analyser && this.freqArray) {
      this.analyser.getByteFrequencyData(this.freqArray);
      let sum = 0;
      // Focus on ggwave acoustic band (1.8 kHz - 6.3 kHz)
      const startBin = Math.floor((1800 / 24000) * this.freqArray.length);
      const endBin = Math.floor((6300 / 24000) * this.freqArray.length);
      for (let i = startBin; i < endBin; i++) {
        sum += this.freqArray[i];
      }
      audioLevel = sum / (endBin - startBin) / 255;
    }

    // Natural rotation + mouse damping
    this.targetRotY += 0.006;
    this.rotX += (this.targetRotX - this.rotX) * 0.1;
    this.rotY += (this.targetRotY - this.rotY) * 0.1;

    // Decay pulse energy
    this.pulseEnergy *= 0.94;
    const totalDisplace = 1 + audioLevel * 0.5 + this.pulseEnergy * 0.35;

    // 3D rotation matrix calculations
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);

    const fov = 340;
    const projected: { x: number; y: number; z: number; scale: number; alpha: number }[] = [];

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      node.phase += node.speed;

      // Radial displacement based on audio and phase wave
      const radialPulse = totalDisplace + Math.sin(node.phase) * 0.06;
      const bx = node.baseX * radialPulse;
      const by = node.baseY * radialPulse;
      const bz = node.baseZ * radialPulse;

      // Rotate Y
      const x1 = bx * cosY + bz * sinY;
      const y1 = by;
      const z1 = -bx * sinY + bz * cosY;

      // Rotate X
      const x2 = x1;
      const y2 = y1 * cosX - z1 * sinX;
      const z2 = y1 * sinX + z1 * cosX;

      // 3D Perspective Projection
      const cameraZ = 300;
      const depth = cameraZ + z2;
      const scale = fov / Math.max(depth, 50);

      projected.push({
        x: cx + x2 * scale,
        y: cy + y2 * scale,
        z: z2,
        scale,
        alpha: Math.min(Math.max((z2 + 130) / 260, 0.15), 1),
      });
    }

    // Render expanding shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 3.5;
      sw.opacity *= 0.95;

      this.ctx.beginPath();
      this.ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `${sw.color} ${sw.opacity})`;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      if (sw.opacity < 0.05 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Draw 3D Edges
    this.ctx.lineWidth = 1.2;
    for (let i = 0; i < this.edges.length; i++) {
      const [idxA, idxB] = this.edges[i];
      const pA = projected[idxA];
      const pB = projected[idxB];

      const avgAlpha = (pA.alpha + pB.alpha) * 0.5;
      if (avgAlpha > 0.15) {
        this.ctx.beginPath();
        this.ctx.moveTo(pA.x, pA.y);
        this.ctx.lineTo(pB.x, pB.y);

        const edgeGrad = this.ctx.createLinearGradient(pA.x, pA.y, pB.x, pB.y);
        edgeGrad.addColorStop(0, `rgba(37, 99, 235, ${pA.alpha * 0.4})`);
        edgeGrad.addColorStop(1, `rgba(249, 115, 22, ${pB.alpha * 0.4})`);
        this.ctx.strokeStyle = edgeGrad;
        this.ctx.stroke();
      }
    }

    // Draw 3D Nodes sorted by depth (back to front)
    const sortedIndices = projected
      .map((p, idx) => ({ idx, z: p.z }))
      .sort((a, b) => a.z - b.z);

    for (let i = 0; i < sortedIndices.length; i++) {
      const idx = sortedIndices[i].idx;
      const p = projected[idx];
      const radius = Math.max(3.2 * p.scale, 1.8);

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

      if (p.z > 25) {
        // Foreground nodes: high-contrast cobalt with clean halo
        this.ctx.fillStyle = '#2563eb';
        this.ctx.shadowColor = 'rgba(37, 99, 235, 0.4)';
        this.ctx.shadowBlur = 6;
      } else if (p.z > -25) {
        // Midground nodes: signal orange
        this.ctx.fillStyle = '#ea580c';
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
      } else {
        // Background nodes: slate
        this.ctx.fillStyle = `rgba(100, 116, 139, ${p.alpha * 0.7})`;
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
      }
      this.ctx.fill();

      // White optical reflection core for 3D depth
      if (p.z > 10) {
        this.ctx.beginPath();
        this.ctx.arc(p.x - 0.8, p.y - 0.8, radius * 0.35, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowBlur = 0;
        this.ctx.fill();
      }
    }
    this.ctx.shadowBlur = 0;
  };
}

export const globalAcousticMesh3D = new AcousticMesh3D();
