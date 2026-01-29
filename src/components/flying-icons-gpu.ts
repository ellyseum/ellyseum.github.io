/**
 * Flying Icons GPU - WebGL instanced icon rendering
 * Renders animated icons flying along bezier paths using GPU
 * Single draw call for all icons + trails
 */

import { flyingIconsVertexShader, flyingIconsFragmentShader } from '@/shaders/flying-icons';

interface IconPath {
  bezierX: number[];
  bezierY: number[];
  progress: number;
  iconType: number;
}

export class FlyingIconsGPU {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private startTime: number = 0;

  // Uniforms
  private uTime: WebGLUniformLocation | null = null;
  private uResolution: WebGLUniformLocation | null = null;

  // Buffers
  private quadBuffer: WebGLBuffer | null = null;
  private instanceBuffer: WebGLBuffer | null = null;

  // Configuration
  private iconCount = 6;
  private trailCount = 4; // Number of trail copies per icon
  private paths: IconPath[] = [];

  // Attribute data
  private instanceData: Float32Array;
  private instanceStride = 12; // floats per instance: offset(2) + bezierX(4) + bezierY(4) + progress(1) + iconType(1)

  private resizeHandler = (): void => this.resize();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'flying-icons-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;
    document.body.appendChild(this.canvas);

    this.startTime = Date.now();
    this.instanceData = new Float32Array(this.iconCount * this.trailCount * this.instanceStride);

    this.initGL();
    this.initPaths();
    this.resize();

    window.addEventListener('resize', this.resizeHandler);
  }

  private initGL(): void {
    if (!this.canvas) return;

    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });

    if (!gl) {
      console.warn('[FlyingIconsGPU] WebGL not available');
      return;
    }

    this.gl = gl;

    // Enable blending for transparency (additive for glows)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // Compile shaders
    const vs = this.compileShader(gl.VERTEX_SHADER, flyingIconsVertexShader);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, flyingIconsFragmentShader);

    if (!vs || !fs) return;

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('[FlyingIconsGPU] Shader link error:', gl.getProgramInfoLog(this.program));
      return;
    }

    gl.useProgram(this.program);

    // Create quad vertices (for each icon instance)
    const quadVerts = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    // Create instance buffer
    this.instanceBuffer = gl.createBuffer();

    // Get uniform locations
    this.uTime = gl.getUniformLocation(this.program, 'uTime');
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Flying icons shader compile error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  private initPaths(): void {
    for (let i = 0; i < this.iconCount; i++) {
      this.paths.push({
        bezierX: this.generateBezierCoords(window.innerWidth),
        bezierY: this.generateBezierCoords(window.innerHeight),
        progress: Math.random(),
        iconType: i % 6,
      });
    }
  }

  private generateBezierCoords(max: number): number[] {
    const margin = 150;

    // Always start offscreen and end offscreen (opposite sides or same side)
    // This prevents "teleporting" when paths regenerate
    const side = Math.random() > 0.5;
    const start = side ? -margin : max + margin;
    const end = Math.random() > 0.3 ? (side ? max + margin : -margin) : (side ? -margin : max + margin);

    // Control points bring the path through the visible area
    const visibleMin = max * 0.1;
    const visibleMax = max * 0.9;
    const cp1 = visibleMin + Math.random() * (visibleMax - visibleMin);
    const cp2 = visibleMin + Math.random() * (visibleMax - visibleMin);

    return [start, cp1, cp2, end];
  }

  private updateInstanceData(): void {
    let offset = 0;

    for (let i = 0; i < this.iconCount; i++) {
      const path = this.paths[i];

      // Check if path needs regeneration (completed)
      const currentProgress = (path.progress + (Date.now() - this.startTime) / 1000 * 0.04) % 1;
      if (currentProgress < 0.01 && Math.random() > 0.95) {
        path.bezierX = this.generateBezierCoords(window.innerWidth);
        path.bezierY = this.generateBezierCoords(window.innerHeight);
      }

      for (let t = 0; t < this.trailCount; t++) {
        // Instance offset (x = icon index, y = trail index)
        this.instanceData[offset++] = i;
        this.instanceData[offset++] = t;

        // Bezier X control points
        this.instanceData[offset++] = path.bezierX[0];
        this.instanceData[offset++] = path.bezierX[1];
        this.instanceData[offset++] = path.bezierX[2];
        this.instanceData[offset++] = path.bezierX[3];

        // Bezier Y control points
        this.instanceData[offset++] = path.bezierY[0];
        this.instanceData[offset++] = path.bezierY[1];
        this.instanceData[offset++] = path.bezierY[2];
        this.instanceData[offset++] = path.bezierY[3];

        // Path progress (starting point)
        this.instanceData[offset++] = path.progress;

        // Icon type
        this.instanceData[offset++] = path.iconType;
      }
    }
  }

  resize(): void {
    if (!this.canvas) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(): void {
    if (!this.gl || !this.program || !this.canvas) return;

    const gl = this.gl;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    const time = (Date.now() - this.startTime) / 1000;

    // Update uniforms - use CSS pixel resolution, not canvas (which has DPR applied)
    gl.uniform1f(this.uTime, time);
    gl.uniform2f(this.uResolution, window.innerWidth, window.innerHeight);

    // Update instance data
    this.updateInstanceData();

    // Draw each instance manually (WebGL 1 doesn't have instancing extension universally)
    const totalInstances = this.iconCount * this.trailCount;

    for (let i = 0; i < totalInstances; i++) {
      const baseOffset = i * this.instanceStride;

      // Set instance uniforms via attributes
      const instanceOffsetLoc = gl.getAttribLocation(this.program, 'instanceOffset');
      const bezierXLoc = gl.getAttribLocation(this.program, 'bezierX');
      const bezierYLoc = gl.getAttribLocation(this.program, 'bezierY');
      const pathProgressLoc = gl.getAttribLocation(this.program, 'pathProgress');
      const iconTypeLoc = gl.getAttribLocation(this.program, 'iconType');

      // Use vertexAttrib for per-instance data (constant for all vertices in this draw)
      gl.vertexAttrib2f(instanceOffsetLoc,
        this.instanceData[baseOffset],
        this.instanceData[baseOffset + 1]
      );
      gl.vertexAttrib4f(bezierXLoc,
        this.instanceData[baseOffset + 2],
        this.instanceData[baseOffset + 3],
        this.instanceData[baseOffset + 4],
        this.instanceData[baseOffset + 5]
      );
      gl.vertexAttrib4f(bezierYLoc,
        this.instanceData[baseOffset + 6],
        this.instanceData[baseOffset + 7],
        this.instanceData[baseOffset + 8],
        this.instanceData[baseOffset + 9]
      );
      gl.vertexAttrib1f(pathProgressLoc, this.instanceData[baseOffset + 10]);
      gl.vertexAttrib1f(iconTypeLoc, this.instanceData[baseOffset + 11]);

      // Bind quad buffer for position
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      const posLoc = gl.getAttribLocation(this.program, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      // Draw the quad
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  destroy(): void {
    window.removeEventListener('resize', this.resizeHandler);

    if (this.gl) {
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
      if (this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer);
      if (this.program) this.gl.deleteProgram(this.program);

      // Properly release WebGL context
      const loseContext = this.gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
    }

    this.gl = null;
    this.program = null;
    this.canvas?.remove();
    this.canvas = null;
  }
}
