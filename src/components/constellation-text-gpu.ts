/**
 * Constellation Text GPU - WebGL particle text rendering
 * Renders text as constellation of stars with connecting lines
 * All rendering done on GPU for maximum performance
 */

import {
  constellationVertexShader,
  constellationFragmentShader,
  constellationLineVertexShader,
  constellationLineFragmentShader,
} from '@/shaders/constellation';

interface Point {
  x: number;
  y: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export class ConstellationTextGPU {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;

  // Point (star) program
  private pointProgram: WebGLProgram | null = null;
  private pointBuffer: WebGLBuffer | null = null;
  private pointUTime: WebGLUniformLocation | null = null;
  private pointUResolution: WebGLUniformLocation | null = null;
  private pointUFadeProgress: WebGLUniformLocation | null = null;
  private pointUPointSize: WebGLUniformLocation | null = null;

  // Line program
  private lineProgram: WebGLProgram | null = null;
  private lineBuffer: WebGLBuffer | null = null;
  private lineUTime: WebGLUniformLocation | null = null;
  private lineUResolution: WebGLUniformLocation | null = null;
  private lineUFadeProgress: WebGLUniformLocation | null = null;

  // Text data
  private words = ['PROTOCOL', 'AUTOMATE', 'BREAK IT', 'SHIP IT', 'DREAM'];
  private currentIndex = 0;
  private points: Point[] = [];
  private lines: Line[] = [];
  private pointData: Float32Array = new Float32Array(0);
  private lineData: Float32Array = new Float32Array(0);

  // Animation state
  private startTime: number = 0;
  private wordStartTime: number = 0;
  private fadeProgress = 0;
  private wordDuration = 5000; // ms per word
  private fadeDuration = 600; // ms for fade transition

  private resizeHandler = (): void => {
    this.resize();
    this.generateConstellation(this.words[this.currentIndex]);
  };

  constructor() {
    // Only show on home page
    if (!document.querySelector('.home')) {
      return;
    }

    // Skip on mobile - too busy
    if (window.innerWidth <= 768) {
      return;
    }

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'constellation-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    `;
    document.body.appendChild(this.canvas);

    this.startTime = Date.now();
    this.wordStartTime = this.startTime;

    this.initGL();
    this.resize();
    this.generateConstellation(this.words[0]);

    window.addEventListener('resize', this.resizeHandler);
  }

  private initGL(): void {
    if (!this.canvas) return;

    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });

    if (!gl) {
      console.warn('WebGL not available for constellation');
      return;
    }

    this.gl = gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Create point program
    this.pointProgram = this.createProgram(constellationVertexShader, constellationFragmentShader);
    if (this.pointProgram) {
      this.pointUTime = gl.getUniformLocation(this.pointProgram, 'uTime');
      this.pointUResolution = gl.getUniformLocation(this.pointProgram, 'uResolution');
      this.pointUFadeProgress = gl.getUniformLocation(this.pointProgram, 'uFadeProgress');
      this.pointUPointSize = gl.getUniformLocation(this.pointProgram, 'uPointSize');
      this.pointBuffer = gl.createBuffer();
    }

    // Create line program
    this.lineProgram = this.createProgram(constellationLineVertexShader, constellationLineFragmentShader);
    if (this.lineProgram) {
      this.lineUTime = gl.getUniformLocation(this.lineProgram, 'uTime');
      this.lineUResolution = gl.getUniformLocation(this.lineProgram, 'uResolution');
      this.lineUFadeProgress = gl.getUniformLocation(this.lineProgram, 'uFadeProgress');
      this.lineBuffer = gl.createBuffer();
    }
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram | null {
    const gl = this.gl!;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

    if (!vs || !fs) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Constellation shader link error:', gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Constellation shader compile error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  private getTextPoints(text: string): Point[] {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d')!;

    // Responsive font size
    const fontSize = Math.min(window.innerWidth / 8, 80);

    tempCanvas.width = window.innerWidth;
    tempCanvas.height = 200;

    ctx.font = `bold ${fontSize}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tempCanvas.width / 2, tempCanvas.height / 2);

    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const points: Point[] = [];
    const step = 6; // Sample every 6 pixels

    for (let y = 0; y < tempCanvas.height; y += step) {
      for (let x = 0; x < tempCanvas.width; x += step) {
        const i = (y * tempCanvas.width + x) * 4;
        if (imageData.data[i + 3] > 128) {
          points.push({
            x: x + (Math.random() - 0.5) * 3,
            y: y + (Math.random() - 0.5) * 3,
          });
        }
      }
    }

    return points;
  }

  private generateConstellation(text: string): void {
    if (!this.gl) return;

    this.points = this.getTextPoints(text);
    this.lines = [];

    // No lines - just stars

    // Build point data: position(2) + index(1) + birthTime(1) = 4 floats per point
    const birthTime = (Date.now() - this.startTime) / 1000;
    this.pointData = new Float32Array(this.points.length * 4);
    for (let i = 0; i < this.points.length; i++) {
      this.pointData[i * 4] = this.points[i].x;
      this.pointData[i * 4 + 1] = this.points[i].y;
      this.pointData[i * 4 + 2] = i;
      this.pointData[i * 4 + 3] = birthTime;
    }

    // Build line data: position(2) + index(1) + birthTime(1) = 4 floats per vertex, 2 vertices per line
    this.lineData = new Float32Array(this.lines.length * 8);
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const offset = i * 8;
      // Vertex 1
      this.lineData[offset] = line.x1;
      this.lineData[offset + 1] = line.y1;
      this.lineData[offset + 2] = i;
      this.lineData[offset + 3] = birthTime;
      // Vertex 2
      this.lineData[offset + 4] = line.x2;
      this.lineData[offset + 5] = line.y2;
      this.lineData[offset + 6] = i;
      this.lineData[offset + 7] = birthTime;
    }

    // Upload to GPU
    const gl = this.gl;
    if (!gl) return;

    if (this.pointBuffer && this.pointData.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.pointData, gl.DYNAMIC_DRAW);
    }

    if (this.lineBuffer && this.lineData.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.lineData, gl.DYNAMIC_DRAW);
    }

    // Reset word timer
    this.wordStartTime = Date.now();
    this.fadeProgress = 0;
  }

  resize(): void {
    if (!this.canvas) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(): void {
    if (!this.gl || !this.pointProgram || !this.lineProgram) return;

    const gl = this.gl;
    const time = (Date.now() - this.startTime) / 1000;
    const wordElapsed = Date.now() - this.wordStartTime;

    // Handle word transitions
    if (wordElapsed > this.wordDuration - this.fadeDuration) {
      this.fadeProgress = (wordElapsed - (this.wordDuration - this.fadeDuration)) / this.fadeDuration;
    }

    if (wordElapsed > this.wordDuration) {
      this.currentIndex = (this.currentIndex + 1) % this.words.length;
      this.generateConstellation(this.words[this.currentIndex]);
    }

    gl.clear(gl.COLOR_BUFFER_BIT);

    const dpr = Math.min(window.devicePixelRatio, 2);

    // Draw lines first (behind stars)
    if (this.lines.length > 0) {
      gl.useProgram(this.lineProgram);
      gl.uniform1f(this.lineUTime, time);
      gl.uniform2f(this.lineUResolution, window.innerWidth, window.innerHeight);
      gl.uniform1f(this.lineUFadeProgress, this.fadeProgress);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);

      const linePosLoc = gl.getAttribLocation(this.lineProgram, 'position');
      const lineIndexLoc = gl.getAttribLocation(this.lineProgram, 'lineIndex');
      const lineBirthLoc = gl.getAttribLocation(this.lineProgram, 'birthTime');

      gl.enableVertexAttribArray(linePosLoc);
      gl.vertexAttribPointer(linePosLoc, 2, gl.FLOAT, false, 16, 0);

      gl.enableVertexAttribArray(lineIndexLoc);
      gl.vertexAttribPointer(lineIndexLoc, 1, gl.FLOAT, false, 16, 8);

      gl.enableVertexAttribArray(lineBirthLoc);
      gl.vertexAttribPointer(lineBirthLoc, 1, gl.FLOAT, false, 16, 12);

      gl.drawArrays(gl.LINES, 0, this.lines.length * 2);
    }

    // Draw points (stars)
    if (this.points.length > 0) {
      gl.useProgram(this.pointProgram);
      gl.uniform1f(this.pointUTime, time);
      gl.uniform2f(this.pointUResolution, window.innerWidth, window.innerHeight);
      gl.uniform1f(this.pointUFadeProgress, this.fadeProgress);
      gl.uniform1f(this.pointUPointSize, 3.0 * dpr);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);

      const pointPosLoc = gl.getAttribLocation(this.pointProgram, 'position');
      const pointIndexLoc = gl.getAttribLocation(this.pointProgram, 'pointIndex');
      const pointBirthLoc = gl.getAttribLocation(this.pointProgram, 'birthTime');

      gl.enableVertexAttribArray(pointPosLoc);
      gl.vertexAttribPointer(pointPosLoc, 2, gl.FLOAT, false, 16, 0);

      gl.enableVertexAttribArray(pointIndexLoc);
      gl.vertexAttribPointer(pointIndexLoc, 1, gl.FLOAT, false, 16, 8);

      gl.enableVertexAttribArray(pointBirthLoc);
      gl.vertexAttribPointer(pointBirthLoc, 1, gl.FLOAT, false, 16, 12);

      gl.drawArrays(gl.POINTS, 0, this.points.length);
    }
  }

  destroy(): void {
    window.removeEventListener('resize', this.resizeHandler);

    if (this.gl) {
      if (this.pointBuffer) this.gl.deleteBuffer(this.pointBuffer);
      if (this.lineBuffer) this.gl.deleteBuffer(this.lineBuffer);
      if (this.pointProgram) this.gl.deleteProgram(this.pointProgram);
      if (this.lineProgram) this.gl.deleteProgram(this.lineProgram);

      // Properly release WebGL context
      const loseContext = this.gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
    }

    this.gl = null;
    this.pointProgram = null;
    this.lineProgram = null;
    this.canvas?.remove();
    this.canvas = null;
  }
}
