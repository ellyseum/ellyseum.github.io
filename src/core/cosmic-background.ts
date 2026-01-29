import { vertexShader, fragmentShader } from '@/shaders/cosmic';

export class CosmicBackground {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null;
  private program: WebGLProgram | null = null;
  private mouse = { x: 0.5, y: 0.5 };
  private targetMouse = { x: 0.5, y: 0.5 };
  private startTime: number;
  private uTime: WebGLUniformLocation | null = null;
  private uMouse: WebGLUniformLocation | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private resolutionScale = 1.0; // Full resolution

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Request high-performance GPU (dedicated graphics card)
    const contextOptions: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false
    };
    this.gl = (canvas.getContext('webgl', contextOptions) ||
               canvas.getContext('experimental-webgl', contextOptions)) as WebGLRenderingContext;
    this.startTime = Date.now();

    if (this.gl) {
      this.init();
    }
  }

  private init(): void {
    const gl = this.gl!;

    const vs = this.compileShader(gl.VERTEX_SHADER, vertexShader);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentShader);

    if (!vs || !fs) return;

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(this.program));
      return;
    }

    gl.useProgram(this.program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    this.uTime = gl.getUniformLocation(this.program, 'uTime');
    this.uMouse = gl.getUniformLocation(this.program, 'uMouse');
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  resize(): void {
    // Render at 50% resolution - cosmic blur hides it, massive perf gain
    const scale = this.resolutionScale;
    const dpr = Math.min(window.devicePixelRatio, 2) * scale;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  setResolutionScale(scale: number): void {
    this.resolutionScale = scale;
    this.resize();
  }

  updateMouse(x: number, y: number): void {
    this.targetMouse.x = x;
    this.targetMouse.y = y;
  }

  render(): void {
    if (!this.gl || !this.program) return;

    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;

    const gl = this.gl;
    const time = (Date.now() - this.startTime) / 1000;

    gl.uniform1f(this.uTime, time);
    gl.uniform2f(this.uMouse, this.mouse.x, this.mouse.y);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  get context(): WebGLRenderingContext | null {
    return this.gl;
  }
}
