/**
 * Jocelyn Ellyse - Immersive Experience v2
 * Raw WebGL + CSS 3D + View Transitions + Flying Words
 */

// ============================================================================
// WEBGL COSMIC BACKGROUND
// ============================================================================

const vertexShader = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uResolution;
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * snoise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float stars(vec2 uv, float density, float brightness) {
    vec2 gv = fract(uv * density) - 0.5;
    vec2 id = floor(uv * density);
    float h = hash(id);
    if (h > 0.95) {
      float d = length(gv);
      float twinkle = 0.5 + 0.5 * sin(uTime * (2.0 + h * 5.0) + h * 6.28);
      return smoothstep(0.06, 0.0, d) * brightness * twinkle;
    }
    return 0.0;
  }

  // Bright stars with sparkle/diffraction spikes
  float brightStar(vec2 uv, float density, float brightness) {
    vec2 gv = fract(uv * density) - 0.5;
    vec2 id = floor(uv * density);
    float h = hash(id);

    if (h > 0.94) {
      float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + h * 3.0) + h * 6.28);

      // Core - smaller
      float d = length(gv);
      float core = smoothstep(0.015, 0.0, d);

      // 4-point diffraction spikes - shorter and thinner
      float spike1 = smoothstep(0.004, 0.0, abs(gv.x)) * smoothstep(0.08, 0.0, abs(gv.y));
      float spike2 = smoothstep(0.004, 0.0, abs(gv.y)) * smoothstep(0.08, 0.0, abs(gv.x));

      // Diagonal spikes - even smaller
      vec2 gvRot = vec2(gv.x + gv.y, gv.x - gv.y) * 0.707;
      float spike3 = smoothstep(0.003, 0.0, abs(gvRot.x)) * smoothstep(0.05, 0.0, abs(gvRot.y)) * 0.4;
      float spike4 = smoothstep(0.003, 0.0, abs(gvRot.y)) * smoothstep(0.05, 0.0, abs(gvRot.x)) * 0.4;

      // Soft glow - smaller
      float glow = smoothstep(0.1, 0.0, d) * 0.2;

      float star = core + spike1 + spike2 + spike3 + spike4 + glow;
      return star * brightness * twinkle;
    }
    return 0.0;
  }

  void main() {
    vec2 uv = vUv;
    vec2 mouseOffset = (uMouse - 0.5) * 0.04;
    float t = uTime * 0.025;

    vec3 col = vec3(0.006, 0.004, 0.015);

    float n1 = fbm(vec3((uv + mouseOffset * 0.5) * 1.5, t)) * 0.5 + 0.5;
    col += vec3(0.4, 0.08, 0.6) * pow(n1, 2.2) * 0.45;

    float n2 = fbm(vec3((uv + mouseOffset) * 2.0 + 5.0, t * 0.7)) * 0.5 + 0.5;
    col += vec3(0.02, 0.28, 0.45) * pow(n2, 2.5) * 0.35;

    float n3 = fbm(vec3((uv + mouseOffset * 1.5) * 3.0 + 10.0, t * 0.5));
    col += vec3(0.65, 0.12, 0.45) * smoothstep(0.1, 0.7, n3) * 0.2;

    col += vec3(1.0, 0.98, 0.94) * (
      stars(uv + mouseOffset * 0.3, 35.0, 1.2) +
      stars(uv + mouseOffset * 0.6 + 0.5, 70.0, 0.8) +
      stars(uv + mouseOffset + 0.3, 140.0, 0.5) +
      stars(uv + mouseOffset * 1.5 + 0.7, 220.0, 0.3)
    );

    // Bright stars with sparkle spikes (subtle)
    col += vec3(0.7, 0.8, 1.0) * brightStar(uv + mouseOffset * 0.2, 18.0, 1.0);
    col += vec3(1.0, 0.7, 0.5) * brightStar(uv + 0.3, 14.0, 0.9);
    col += vec3(1.0, 0.9, 0.95) * brightStar(uv + mouseOffset * 0.1 + 0.5, 10.0, 0.8);

    col *= smoothstep(0.0, 0.55, 1.0 - length((uv - 0.5) * 1.4)) * 1.15;

    gl_FragColor = vec4(col, 1.0);
  }
`;

class CosmicBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!this.gl) return;

    this.mouse = { x: 0.5, y: 0.5 };
    this.targetMouse = { x: 0.5, y: 0.5 };
    this.startTime = Date.now();

    this.init();
  }

  init() {
    const gl = this.gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, vertexShader);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentShader);

    this.program = gl.createProgram();
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

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  updateMouse(x, y) {
    this.targetMouse.x = x;
    this.targetMouse.y = y;
  }

  render() {
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
}

// ============================================================================
// CONSTELLATION TEXT
// ============================================================================

class ConstellationText {
  constructor() {
    this.words = ['DEVELOPER', 'CREATOR', 'EXPLORER'];
    this.currentIndex = 0;
    this.container = null;
    this.stars = [];
    this.lines = [];
    this.intervalId = null;

    // Only show on home page
    if (!document.querySelector('.home')) return;

    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'constellation-container';
    document.body.appendChild(this.container);

    this.createConstellation(this.words[0]);

    this.intervalId = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.words.length;
      this.fadeOut(() => {
        this.createConstellation(this.words[this.currentIndex]);
      });
    }, 5000);
  }

  getTextPoints(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = Math.min(window.innerWidth / 8, 80);

    canvas.width = window.innerWidth;
    canvas.height = 200;

    ctx.font = `bold ${fontSize}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const points = [];
    const step = 6;

    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const i = (y * canvas.width + x) * 4;
        if (imageData.data[i + 3] > 128) {
          points.push({
            x: x + (Math.random() - 0.5) * 3,
            y: y + (Math.random() - 0.5) * 3
          });
        }
      }
    }

    return points;
  }

  createConstellation(text) {
    this.container.innerHTML = '';
    this.stars = [];
    this.lines = [];

    const points = this.getTextPoints(text);

    points.forEach((point, i) => {
      const star = document.createElement('div');
      star.className = 'constellation-star';
      star.style.left = `${point.x}px`;
      star.style.top = `${point.y}px`;
      star.style.animationDelay = `${i * 15}ms`;

      this.container.appendChild(star);
      this.stars.push({ el: star, point });
    });

    const maxDist = 25;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist && Math.random() > 0.6) {
          const line = document.createElement('div');
          line.className = 'constellation-line';

          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          line.style.left = `${points[i].x}px`;
          line.style.top = `${points[i].y}px`;
          line.style.width = `${dist}px`;
          line.style.transform = `rotate(${angle}deg)`;
          line.style.animationDelay = `${(i + j) * 8}ms`;

          this.container.appendChild(line);
          this.lines.push(line);
        }
      }
    }
  }

  fadeOut(callback) {
    this.container.classList.add('fading');
    setTimeout(() => {
      this.container.classList.remove('fading');
      callback();
    }, 600);
  }

  destroy() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.container) this.container.remove();
  }
}

// ============================================================================
// FLYING ICONS - Better SVGs
// ============================================================================

class FlyingIcons {
  constructor() {
    // Proper detailed SVG icons
    this.icons = [
      {
        name: 'github',
        svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>'
      },
      {
        name: 'claude',
        svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 14.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm1.5-3.5c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm4.5 3.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z"/><circle cx="12" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="0.5"/></svg>'
      },
      {
        name: 'copilot',
        svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 2.237.74 4.3 1.988 5.963l-.487 3.068a.75.75 0 001.029.81l2.905-1.21A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-2.5 13a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm-5.5-5c0-1.657 1.343-3 3-3s3 1.343 3 3v.5h-6V10z"/></svg>'
      },
      {
        name: 'vscode',
        svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.583 2.243L8.17 9.962 3.4 6.087.55 7.175v9.65l2.85 1.088 4.77-3.875 9.413 7.72 5.867-2.393V4.636l-5.867-2.393zM3.4 13.738V10.26l2.1 1.74-2.1 1.738zm12.35 3.987l-5.55-4.55v-.35l5.55-4.55v9.45z"/></svg>'
      },
      {
        name: 'cursor',
        svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/><path d="M13 12h7v2h-7z" fill-opacity="0.6"/></svg>'
      },
      {
        name: 'terminal',
        svg: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 8l4 4-4 4M12 16h6"/></svg>'
      }
    ];

    this.flyingElements = [];

    // Only show on home page
    if (!document.querySelector('.home')) return;

    this.init();
  }

  init() {
    const count = Math.min(this.icons.length, 5 + Math.floor(Math.random() * 2));

    for (let i = 0; i < count; i++) {
      this.createFlyingIcon(i);
    }
  }

  createFlyingIcon(index) {
    const icon = this.icons[index % this.icons.length];

    const container = document.createElement('div');
    container.className = 'flying-icon';
    container.innerHTML = `
      <div class="flying-icon-trail"></div>
      <div class="flying-icon-trail"></div>
      <div class="flying-icon-trail"></div>
      <div class="flying-icon-body">${icon.svg}</div>
    `;

    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;

    container.style.left = `${startX}px`;
    container.style.top = `${startY}px`;

    document.body.appendChild(container);
    this.animateIcon(container, index);
    this.flyingElements.push(container);
  }

  animateIcon(element, index) {
    const duration = 15000 + Math.random() * 10000;
    const delay = index * 2000;

    let path = this.generatePath();
    let startTime = null;
    let currentX = parseFloat(element.style.left);
    let currentY = parseFloat(element.style.top);

    const animate = (timestamp) => {
      if (!document.body.contains(element)) return;

      if (!startTime) startTime = timestamp + delay;
      if (timestamp < startTime) {
        requestAnimationFrame(animate);
        return;
      }

      const elapsed = timestamp - startTime;
      const progress = (elapsed % duration) / duration;

      const t = progress;
      const x = this.bezier(t, path.x);
      const y = this.bezier(t, path.y);

      const dx = x - currentX;
      const dy = y - currentY;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.transform = `rotate(${angle}deg)`;

      currentX = x;
      currentY = y;

      if (progress > 0.99) {
        startTime = null;
        path = this.generatePath();
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  generatePath() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const margin = 100;

    return {
      x: [
        -margin + Math.random() * (w + margin),
        Math.random() * w,
        Math.random() * w,
        w + margin - Math.random() * (w + margin)
      ],
      y: [
        -margin + Math.random() * (h + margin),
        Math.random() * h,
        Math.random() * h,
        h + margin - Math.random() * (h + margin)
      ]
    };
  }

  bezier(t, points) {
    const [p0, p1, p2, p3] = points;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
  }

  destroy() {
    this.flyingElements.forEach(el => el.remove());
    this.flyingElements = [];
  }
}

// ============================================================================
// CSS 3D CARDS - Enhanced with better hover effects
// ============================================================================

class Cards3D {
  constructor() {
    this.cards = document.querySelectorAll('.post-item');
    this.mouse = { x: 0, y: 0 };
    this.targetMouse = { x: 0, y: 0 };

    if (this.cards.length === 0) return;

    this.init();
  }

  init() {
    const container = document.querySelector('.post-list');
    if (container) {
      container.style.perspective = '1200px';
      container.style.perspectiveOrigin = '50% 50%';
    }

    this.cards.forEach((card, i) => {
      card.style.transformStyle = 'preserve-3d';
      card.style.willChange = 'transform';
      card.style.cursor = 'pointer';

      // Random initial rotation for 3D feel
      const baseRotX = (Math.random() - 0.5) * 6;
      const baseRotY = (Math.random() - 0.5) * 8;
      const baseZ = i * -15 + (Math.random() - 0.5) * 20;

      card.dataset.baseRotX = baseRotX;
      card.dataset.baseRotY = baseRotY;
      card.dataset.baseZ = baseZ;
      card.dataset.index = i;

      // Remove CSS animation after it completes so JS can control transform
      // CSS animation with fill:forwards overrides inline styles
      const handleAnimationEnd = () => {
        card.style.animation = 'none';
        card.style.opacity = '1';
        card.style.transition = 'transform 0.15s ease-out, box-shadow 0.2s ease-out, border-color 0.2s';
        card.removeEventListener('animationend', handleAnimationEnd);
      };
      card.addEventListener('animationend', handleAnimationEnd);

      // Also check if animation already finished (loaded class added before Cards3D init)
      const computed = window.getComputedStyle(card);
      if (computed.animationName === 'none' || computed.opacity === '1') {
        card.style.animation = 'none';
        card.style.opacity = '1';
        card.style.transition = 'transform 0.15s ease-out, box-shadow 0.2s ease-out, border-color 0.2s';
      }

      // Enhanced hover effect per card
      card.addEventListener('mouseenter', () => {
        card.dataset.hovered = 'true';
      });

      card.addEventListener('mouseleave', () => {
        card.dataset.hovered = 'false';
      });
    });
  }

  updateMouse(x, y) {
    this.targetMouse.x = x;
    this.targetMouse.y = y;
  }

  update() {
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.1;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.1;

    this.cards.forEach(card => {
      const baseRotX = parseFloat(card.dataset.baseRotX) || 0;
      const baseRotY = parseFloat(card.dataset.baseRotY) || 0;
      const baseZ = parseFloat(card.dataset.baseZ) || 0;
      const hovered = card.dataset.hovered === 'true';

      // More pronounced rotation
      const rotX = baseRotX + this.mouse.y * 15;
      const rotY = baseRotY - this.mouse.x * 18;
      const z = hovered ? baseZ + 40 : baseZ;
      const scale = hovered ? 1.03 : 1;

      card.style.transform = `
        translateZ(${z}px)
        rotateX(${rotX}deg)
        rotateY(${rotY}deg)
        scale(${scale})
      `;
    });
  }
}

// ============================================================================
// VIEW TRANSITIONS - Flying cards + Word assembly + Prefetching
// ============================================================================

class ViewTransitions {
  constructor() {
    this.isNavigating = false;
    this.prefetchCache = new Map();
    this.prefetchingUrls = new Set();
    this.worker = null;
    this.pendingWorkerCallbacks = new Map();
    this.initWorker();
    this.init();
  }

  initWorker() {
    try {
      this.worker = new Worker('/assets/js/nav-worker.js');
      this.worker.onmessage = (e) => {
        const { type, url, title, mainContent, processedContent, timestamp, error } = e.data;

        if (type === 'parsed') {
          // Create prerender element with processed content
          const prerender = document.createElement('div');
          prerender.className = 'prerender-cache';
          prerender.dataset.href = url;
          prerender.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;';
          prerender.innerHTML = mainContent;
          document.body.appendChild(prerender);

          this.prefetchCache.set(url, {
            title,
            mainContent,
            processedContent, // Pre-wrapped words for animation
            prerender,
            timestamp
          });

          this.prefetchingUrls.delete(url);

          // Resolve any pending callbacks
          const callback = this.pendingWorkerCallbacks.get(url);
          if (callback) {
            callback();
            this.pendingWorkerCallbacks.delete(url);
          }
        } else if (type === 'error') {
          console.error('Worker error:', error);
          this.prefetchingUrls.delete(url);
        }
      };
    } catch (e) {
      console.log('Web Worker not available, using main thread');
      this.worker = null;
    }
  }

  init() {
    // Only intercept navigation if View Transitions API is supported
    if (!document.startViewTransition) {
      console.log('View Transitions API not supported');
      return;
    }

    // Prefetch on hover/focus (guard against non-Element targets)
    document.addEventListener('mouseenter', (e) => {
      if (!e.target?.closest) return;
      const link = e.target.closest('a');
      if (link) this.prefetch(link.getAttribute('href'));
    }, true);

    document.addEventListener('focusin', (e) => {
      if (!e.target?.closest) return;
      const link = e.target.closest('a');
      if (link) this.prefetch(link.getAttribute('href'));
    });

    // Also prefetch on touchstart for mobile
    document.addEventListener('touchstart', (e) => {
      if (!e.target?.closest) return;
      const link = e.target.closest('a');
      if (link) this.prefetch(link.getAttribute('href'));
    }, { passive: true });

    // Intercept all internal link clicks
    document.addEventListener('click', (e) => {
      if (!e.target?.closest) return;
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;

      e.preventDefault();
      this.navigate(href);
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      this.navigate(location.pathname, false);
    });

    // Prefetch visible links on idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this.prefetchVisibleLinks(), { timeout: 2000 });
    } else {
      setTimeout(() => this.prefetchVisibleLinks(), 1000);
    }

    // Always prefetch home page for fast back navigation
    this.prefetch('/');

    // Clean old cache entries every 2 minutes
    setInterval(() => this.cleanCache(), 120000);
  }

  cleanCache() {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [url, data] of this.prefetchCache) {
      if (now - data.timestamp > maxAge) {
        if (data.prerender) data.prerender.remove();
        this.prefetchCache.delete(url);
      }
    }
  }

  prefetch(href) {
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
    if (this.prefetchCache.has(href) || this.prefetchingUrls.has(href)) return;

    this.prefetchingUrls.add(href);

    // Use Web Worker if available (offloads parsing from main thread)
    if (this.worker) {
      this.worker.postMessage({ type: 'parse', url: href });
    } else {
      // Fallback to main thread
      fetch(href, { priority: 'low' })
        .then(response => response.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          const prerender = document.createElement('div');
          prerender.className = 'prerender-cache';
          prerender.dataset.href = href;
          prerender.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;';
          prerender.innerHTML = doc.querySelector('.site-content')?.innerHTML || '';
          document.body.appendChild(prerender);

          this.prefetchCache.set(href, {
            title: doc.title,
            mainContent: prerender.innerHTML,
            prerender,
            timestamp: Date.now()
          });
          this.prefetchingUrls.delete(href);
        })
        .catch(() => {
          this.prefetchingUrls.delete(href);
        });
    }
  }

  prefetchVisibleLinks() {
    const links = document.querySelectorAll('a[href^="/"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !this.prefetchCache.has(href)) {
        this.prefetch(href);
      }
    });
  }

  cacheCurrentPage() {
    // Cache current page for instant back navigation
    const currentUrl = location.pathname;
    if (this.prefetchCache.has(currentUrl)) return;

    const main = document.querySelector('.site-content');
    if (!main) return;

    // Create a fake doc structure
    const doc = document.implementation.createHTMLDocument(document.title);
    const newMain = doc.createElement('main');
    newMain.className = 'site-content';
    newMain.innerHTML = main.innerHTML;
    doc.body.appendChild(newMain);

    // Create prerender element
    const prerender = document.createElement('div');
    prerender.className = 'prerender-cache';
    prerender.dataset.href = currentUrl;
    prerender.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;';
    prerender.innerHTML = main.innerHTML;
    document.body.appendChild(prerender);

    this.prefetchCache.set(currentUrl, {
      doc,
      title: document.title,
      prerender,
      timestamp: Date.now()
    });
  }

  async navigate(url, pushState = true) {
    if (this.isNavigating) return;
    this.isNavigating = true;

    // Cache current page before leaving for instant back
    this.cacheCurrentPage();

    const isGoingToPost = url.includes('/20') || url.includes('/posts/');
    const isGoingHome = url === '/' || url === '/index.html';

    try {
      // Use cached content or fetch
      let newDoc, newTitle;

      let prerenderEl = null;
      const cached = this.prefetchCache.get(url);
      if (cached) {
        newDoc = cached.doc;
        newTitle = cached.title;
        prerenderEl = cached.prerender;
      } else {
        // Show loading state if we need to fetch
        document.body.classList.add('navigating');

        // Wait for in-flight prefetch (worker) or start new fetch
        if (this.prefetchingUrls.has(url)) {
          // Wait for worker to finish
          await new Promise(resolve => {
            this.pendingWorkerCallbacks.set(url, resolve);
            // Timeout fallback
            setTimeout(() => {
              if (this.pendingWorkerCallbacks.has(url)) {
                this.pendingWorkerCallbacks.delete(url);
                resolve();
              }
            }, 3000);
          });
        }

        // Check cache again after waiting
        const cachedAfterWait = this.prefetchCache.get(url);
        if (cachedAfterWait) {
          newDoc = cachedAfterWait.doc;
          newTitle = cachedAfterWait.title;
          prerenderEl = cachedAfterWait.prerender;
        } else {
          // Fetch if still not cached
          const response = await fetch(url);
          const html = await response.text();
          const parser = new DOMParser();
          newDoc = parser.parseFromString(html, 'text/html');
          newTitle = newDoc.title;
        }

        // Small delay so loading bar is visible (avoid flash)
        await new Promise(r => setTimeout(r, 100));
        document.body.classList.remove('navigating');
      }

      // Yield to browser before starting animations
      await new Promise(r => requestAnimationFrame(r));

      // Animate out current content
      if (isGoingToPost) {
        this.animateCardsOut(); // Don't await - let it run
        await new Promise(r => setTimeout(r, 400)); // Wait for animation to mostly complete
      } else if (isGoingHome) {
        this.animateContentOut();
        await new Promise(r => setTimeout(r, 300));
      }

      // Yield before DOM manipulation
      await new Promise(r => requestAnimationFrame(r));

      // Swap content
      const main = document.querySelector('.site-content');
      if (main) {
        // Clear first to reduce layout thrashing
        main.style.opacity = '0';
        await new Promise(r => requestAnimationFrame(r));

        // For posts, use pre-processed content (words already wrapped by worker)
        const cachedData = this.prefetchCache.get(url);
        if (isGoingToPost && cachedData?.processedContent) {
          // Replace just the post-content part with pre-wrapped words
          if (prerenderEl) {
            main.innerHTML = prerenderEl.innerHTML;
            const postContent = main.querySelector('.post-content');
            if (postContent && cachedData.processedContent) {
              // Extract just the post-content from processed
              const temp = document.createElement('div');
              temp.innerHTML = cachedData.processedContent;
              const processedPostContent = temp.querySelector('.post-content');
              if (processedPostContent) {
                postContent.innerHTML = processedPostContent.innerHTML;
              }
            }
            prerenderEl.remove();
          }
        } else if (prerenderEl) {
          main.innerHTML = prerenderEl.innerHTML;
          prerenderEl.remove();
        } else if (newDoc) {
          const newMain = newDoc.querySelector('.site-content');
          if (newMain) main.innerHTML = newMain.innerHTML;
        }

        await new Promise(r => requestAnimationFrame(r));
        main.style.opacity = '1';
      }

      // Update title
      document.title = newTitle;

      // Animate in new content
      if (isGoingToPost) {
        await this.animateWordsIn();
      } else if (isGoingHome) {
        await this.animateCardsIn();
      }

      if (pushState) {
        history.pushState({}, '', url);
      }

      // Reinitialize experience for new page
      window.experience?.reinit();

    } catch (error) {
      console.error('Navigation error:', error);
      window.location.href = url;
    }

    this.isNavigating = false;
  }

  async animateCardsOut() {
    const cards = document.querySelectorAll('.post-item');
    const directions = ['left', 'right', 'top', 'bottom'];

    const animations = Array.from(cards).map((card, i) => {
      const direction = directions[i % directions.length];
      const rect = card.getBoundingClientRect();

      let x = 0, y = 0, rotate = 0;

      switch (direction) {
        case 'left':
          x = -(rect.left + rect.width + 100);
          rotate = -15 - Math.random() * 20;
          break;
        case 'right':
          x = window.innerWidth - rect.left + 100;
          rotate = 15 + Math.random() * 20;
          break;
        case 'top':
          y = -(rect.top + rect.height + 100);
          rotate = (Math.random() - 0.5) * 30;
          break;
        case 'bottom':
          y = window.innerHeight - rect.top + 100;
          rotate = (Math.random() - 0.5) * 30;
          break;
      }

      return card.animate([
        {
          transform: card.style.transform,
          opacity: 1
        },
        {
          transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(0.8)`,
          opacity: 0
        }
      ], {
        duration: 600,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        delay: i * 50,
        fill: 'forwards'
      }).finished;
    });

    await Promise.all(animations);
  }

  async animateCardsIn() {
    await new Promise(r => setTimeout(r, 100));

    const cards = document.querySelectorAll('.post-item');
    const directions = ['left', 'right', 'top', 'bottom'];

    const animations = cards.length > 0 ? [] : null;

    cards.forEach((card, i) => {
      const direction = directions[i % directions.length];

      let startX = 0, startY = 0, startRotate = 0;

      switch (direction) {
        case 'left':
          startX = -window.innerWidth;
          startRotate = -20;
          break;
        case 'right':
          startX = window.innerWidth;
          startRotate = 20;
          break;
        case 'top':
          startY = -window.innerHeight;
          startRotate = (Math.random() - 0.5) * 30;
          break;
        case 'bottom':
          startY = window.innerHeight;
          startRotate = (Math.random() - 0.5) * 30;
          break;
      }

      card.style.opacity = '0';
      card.style.transform = `translate(${startX}px, ${startY}px) rotate(${startRotate}deg)`;

      const anim = card.animate([
        {
          transform: `translate(${startX}px, ${startY}px) rotate(${startRotate}deg)`,
          opacity: 0
        },
        {
          transform: 'translate(0, 0) rotate(0deg)',
          opacity: 1
        }
      ], {
        duration: 800,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        delay: 100 + i * 100,
        fill: 'forwards'
      });

      // When animation finishes, commit styles and cancel so JS can control transform
      anim.finished.then(() => {
        card.style.opacity = '1';
        card.style.transform = '';
        anim.cancel();
      });

      animations.push(anim.finished);
    });

    // Wait for all animations to finish before reinitializing Cards3D
    if (animations && animations.length > 0) {
      await Promise.all(animations);
    }

    // Reinitialize 3D cards after animations are cleared
    if (window.experience) {
      window.experience.cards = new Cards3D();
    }
  }

  async animateContentOut() {
    const content = document.querySelector('.post, .page');
    if (!content) return;

    await content.animate([
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-50px) scale(0.95)' }
    ], {
      duration: 400,
      easing: 'ease-in',
      fill: 'forwards'
    }).finished;
  }

  async animateWordsIn() {
    await new Promise(r => setTimeout(r, 150));

    const postContent = document.querySelector('.post-content');
    const postHeader = document.querySelector('.post-header');

    if (!postContent) return;

    // Animate header first
    if (postHeader) {
      postHeader.style.opacity = '0';
      postHeader.style.transform = 'translateY(-30px)';

      postHeader.animate([
        { opacity: 0, transform: 'translateY(-30px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 600,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        fill: 'forwards'
      });
    }

    // Get all text nodes and elements
    const elements = postContent.querySelectorAll('p, h2, h3, li, blockquote, pre');

    elements.forEach((el, blockIndex) => {
      // For code blocks, animate as whole
      if (el.tagName === 'PRE') {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px) rotateX(-10deg)';

        el.animate([
          { opacity: 0, transform: 'translateY(40px) rotateX(-10deg)' },
          { opacity: 1, transform: 'translateY(0) rotateX(0)' }
        ], {
          duration: 700,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          delay: 300 + blockIndex * 80,
          fill: 'forwards'
        });
        return;
      }

      // Check if words are already wrapped (by worker)
      let wordSpans = el.querySelectorAll('.flying-word');

      // If not pre-wrapped, wrap now (fallback)
      if (wordSpans.length === 0) {
        const text = el.innerHTML;
        const words = text.split(/(\s+)/);

        el.innerHTML = words.map((word, i) => {
          if (word.trim() === '') return word;
          return `<span class="flying-word">${word}</span>`;
        }).join('');

        wordSpans = el.querySelectorAll('.flying-word');
      }

      wordSpans.forEach((span, wordIndex) => {
        // Random starting position from edges
        const edge = Math.floor(Math.random() * 4);
        let startX = 0, startY = 0;

        switch (edge) {
          case 0: // left
            startX = -window.innerWidth * 0.5 - Math.random() * 200;
            startY = (Math.random() - 0.5) * 400;
            break;
          case 1: // right
            startX = window.innerWidth * 0.5 + Math.random() * 200;
            startY = (Math.random() - 0.5) * 400;
            break;
          case 2: // top
            startX = (Math.random() - 0.5) * 600;
            startY = -window.innerHeight * 0.3 - Math.random() * 200;
            break;
          case 3: // bottom
            startX = (Math.random() - 0.5) * 600;
            startY = window.innerHeight * 0.3 + Math.random() * 200;
            break;
        }

        const rotation = (Math.random() - 0.5) * 180;
        const delay = 400 + blockIndex * 60 + wordIndex * 20;

        span.style.display = 'inline-block';
        span.style.opacity = '0';

        span.animate([
          {
            opacity: 0,
            transform: `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(0.5)`,
            filter: 'blur(4px)'
          },
          {
            opacity: 0.7,
            transform: `translate(${startX * 0.3}px, ${startY * 0.3}px) rotate(${rotation * 0.3}deg) scale(0.9)`,
            filter: 'blur(1px)',
            offset: 0.6
          },
          {
            opacity: 1,
            transform: 'translate(0, 0) rotate(0deg) scale(1)',
            filter: 'blur(0)'
          }
        ], {
          duration: 900,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          delay: delay,
          fill: 'forwards'
        });
      });
    });
  }
}

// ============================================================================
// MAIN EXPERIENCE
// ============================================================================

class Experience {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.background = null;
    this.cards = null;
    this.constellation = null;
    this.flyingIcons = null;
    this.viewTransitions = null;

    // Performance monitoring - detect and target display refresh rate
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fps = 60;
    // Tiers: superUltra (480), ultra (240), high (120), medium (60), low (30), potato (15)
    this.performanceTier = 'medium';
    this.targetFPS = 60;
    this.detectedRefreshRate = 60;

    this.init();
  }

  init() {
    // Detect low performance devices
    this.detectPerformance();

    if (this.canvas) {
      this.background = new CosmicBackground(this.canvas);
    }

    this.cards = new Cards3D();
    this.constellation = new ConstellationText();
    this.flyingIcons = new FlyingIcons();
    this.viewTransitions = new ViewTransitions();

    // Mouse events
    window.addEventListener('mousemove', (e) => this.handlePointer(e.clientX, e.clientY));

    // Touch events for mobile
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.handlePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.handlePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    // Device orientation for mobile parallax
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && e.beta !== null) {
          // Map device tilt to normalized coordinates
          const x = (e.gamma / 45) * 0.5 + 0.5; // gamma: -45 to 45
          const y = ((e.beta - 45) / 45) * 0.5 + 0.5; // beta: 0 to 90

          if (this.background) {
            this.background.updateMouse(
              Math.max(0, Math.min(1, x)),
              Math.max(0, Math.min(1, y))
            );
          }
        }
      });
    }

    this.animate();
    document.body.classList.add('loaded');
  }

  detectPerformance() {
    // Check for mobile/low-end device indicators
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
    const slowConnection = navigator.connection &&
      (navigator.connection.effectiveType === 'slow-2g' || navigator.connection.effectiveType === '2g');

    if (lowMemory || slowConnection) {
      this.performanceTier = 'low';
      this.targetFPS = 30;
    } else if (isMobile) {
      this.performanceTier = 'medium';
      this.targetFPS = 60;
    } else {
      // Detect actual display refresh rate
      this.detectRefreshRate();
    }

    // Start FPS monitoring
    this.monitorFPS();
  }

  detectRefreshRate() {
    let frames = 0;
    let startTime = performance.now();

    const countFrames = () => {
      frames++;
      const elapsed = performance.now() - startTime;

      if (elapsed < 1000) {
        requestAnimationFrame(countFrames);
      } else {
        // frames counted in ~1 second = refresh rate
        this.detectedRefreshRate = Math.round(frames);
        this.setTierFromRefreshRate(this.detectedRefreshRate);
      }
    };

    requestAnimationFrame(countFrames);
  }

  setTierFromRefreshRate(hz) {
    if (hz >= 400) {
      this.performanceTier = 'superUltra';
      this.targetFPS = 480;
    } else if (hz >= 200) {
      this.performanceTier = 'ultra';
      this.targetFPS = 240;
    } else if (hz >= 100) {
      this.performanceTier = 'high';
      this.targetFPS = 120;
    } else {
      this.performanceTier = 'medium';
      this.targetFPS = 60;
    }
  }

  monitorFPS() {
    let struggleStreak = 0;
    let excelStreak = 0;
    let warmupComplete = false;

    // Create FPS monitor container
    this.fpsMonitor = document.createElement('div');
    this.fpsMonitor.className = 'fps-monitor';

    // Create FPS graph canvas
    this.fpsGraph = document.createElement('canvas');
    this.fpsGraph.className = 'fps-graph';
    this.fpsGraph.width = 100;
    this.fpsGraph.height = 32;
    this.fpsGraphCtx = this.fpsGraph.getContext('2d');
    this.fpsHistory = [];
    this.maxHistoryLength = 50;

    // Create FPS counter element
    this.fpsCounter = document.createElement('div');
    this.fpsCounter.className = 'fps-counter';
    this.fpsCounter.textContent = '-- FPS';

    this.fpsMonitor.appendChild(this.fpsGraph);
    this.fpsMonitor.appendChild(this.fpsCounter);
    document.body.appendChild(this.fpsMonitor);

    // Wait for page to settle before monitoring
    setTimeout(() => { warmupComplete = true; }, 5000);

    setInterval(() => {
      this.fps = this.frameCount * 2; // Counts per 500ms * 2
      this.frameCount = 0;

      // Update FPS counter display
      const tierLabels = {
        superUltra: '🚀 SUPER ULTRA',
        ultra: '⚡ ULTRA',
        high: '✨ HIGH',
        medium: '● MEDIUM',
        low: '◐ LOW',
        potato: '🥔 POTATO'
      };
      this.fpsCounter.textContent = `${this.fps} FPS · ${tierLabels[this.performanceTier] || this.performanceTier}`;
      this.fpsCounter.dataset.tier = this.performanceTier;
      this.fpsMonitor.dataset.tier = this.performanceTier;

      // Update FPS graph
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.maxHistoryLength) {
        this.fpsHistory.shift();
      }
      this.drawFPSGraph();

      if (!warmupComplete) return;

      // Check if we're struggling to hit target (below 50% of target)
      const struggling = this.fps < this.targetFPS * 0.5;
      // Check if we're exceeding target and could upgrade (above 90% of next tier)
      const nextTierFPS = this.getNextTierFPS();
      const excelling = nextTierFPS && this.fps >= nextTierFPS * 0.9;

      if (struggling) {
        struggleStreak++;
        excelStreak = 0;
        // Require 6 consecutive readings (3 seconds) before downgrading
        if (struggleStreak >= 6) {
          this.downgradePerformance();
          struggleStreak = 0;
        }
      } else if (excelling) {
        excelStreak++;
        struggleStreak = 0;
        // Require 10 consecutive readings (5 seconds) before upgrading
        if (excelStreak >= 10) {
          this.upgradePerformance();
          excelStreak = 0;
        }
      } else {
        // Gradually reset streaks when performance is normal
        struggleStreak = Math.max(0, struggleStreak - 1);
        excelStreak = Math.max(0, excelStreak - 1);
      }
    }, 500);
  }

  getNextTierFPS() {
    const tiers = ['potato', 'low', 'medium', 'high', 'ultra', 'superUltra'];
    const fps =   [15,       30,    60,       120,    240,     480];

    const currentIndex = tiers.indexOf(this.performanceTier);
    if (currentIndex < tiers.length - 1) {
      return fps[currentIndex + 1];
    }
    return null; // Already at max tier
  }

  downgradePerformance() {
    const tiers = ['superUltra', 'ultra', 'high', 'medium', 'low', 'potato'];
    const fps =   [480,          240,     120,    60,       30,    15];

    const currentIndex = tiers.indexOf(this.performanceTier);
    if (currentIndex < tiers.length - 1) {
      this.performanceTier = tiers[currentIndex + 1];
      this.targetFPS = fps[currentIndex + 1];

      if (this.performanceTier === 'potato') {
        this.enablePotatoMode();
      }
    }
    // Already at potato, thoughts and prayers 🥔
  }

  upgradePerformance() {
    const tiers = ['potato', 'low', 'medium', 'high', 'ultra', 'superUltra'];
    const fps =   [15,       30,    60,       120,    240,     480];

    const currentIndex = tiers.indexOf(this.performanceTier);
    if (currentIndex < tiers.length - 1) {
      const oldTier = this.performanceTier;
      this.performanceTier = tiers[currentIndex + 1];
      this.targetFPS = fps[currentIndex + 1];

      // If upgrading from potato, restore effects
      if (oldTier === 'potato') {
        this.disablePotatoMode();
      }
    }
    // Already at superUltra, you absolute legend 🚀
  }

  disablePotatoMode() {
    document.body.classList.remove('potato-mode');

    // Restore WebGL resolution
    if (this.background && this.canvas) {
      const dpr = Math.min(window.devicePixelRatio, 2);
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      this.background.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    // Reinitialize effects
    if (!this.constellation) {
      this.constellation = new ConstellationText();
    }
    if (!this.flyingIcons) {
      this.flyingIcons = new FlyingIcons();
    }
  }

  drawFPSGraph() {
    const ctx = this.fpsGraphCtx;
    const w = this.fpsGraph.width;
    const h = this.fpsGraph.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (this.fpsHistory.length < 2) return;

    // Determine max FPS for scaling (use target or actual max, whichever is higher)
    const maxFPS = Math.max(this.targetFPS, ...this.fpsHistory) * 1.1;

    // Get tier color
    const tierColors = {
      superUltra: '#f0abfc',
      ultra: '#c084fc',
      high: '#22d3ee',
      medium: '#4ade80',
      low: '#fbbf24',
      potato: '#f87171'
    };
    const color = tierColors[this.performanceTier] || '#4ade80';

    // Draw target line
    const targetY = h - (this.targetFPS / maxFPS) * h;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(w, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw FPS line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const step = w / (this.maxHistoryLength - 1);

    this.fpsHistory.forEach((fps, i) => {
      const x = i * step;
      const y = h - (fps / maxFPS) * h;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw fill under line
    ctx.lineTo((this.fpsHistory.length - 1) * step, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
    ctx.fill();
  }

  enablePotatoMode() {
    // Disable expensive effects
    if (this.constellation) {
      this.constellation.destroy();
      this.constellation = null;
    }
    if (this.flyingIcons) {
      this.flyingIcons.destroy();
      this.flyingIcons = null;
    }

    // Add potato class for CSS fallbacks
    document.body.classList.add('potato-mode');

    // Reduce WebGL resolution
    if (this.background && this.canvas) {
      this.canvas.width = Math.floor(window.innerWidth * 0.5);
      this.canvas.height = Math.floor(window.innerHeight * 0.5);
      this.background.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  handlePointer(clientX, clientY) {
    const x = clientX / window.innerWidth;
    const y = 1 - clientY / window.innerHeight;

    if (this.background) {
      this.background.updateMouse(x, y);
    }

    const nx = (clientX / window.innerWidth) * 2 - 1;
    const ny = -((clientY / window.innerHeight) * 2 - 1);

    if (this.cards) {
      this.cards.updateMouse(nx, ny);
    }
  }

  animate(timestamp = 0) {
    // FPS throttling
    const frameInterval = 1000 / this.targetFPS;
    const delta = timestamp - this.lastFrameTime;

    if (delta >= frameInterval) {
      this.lastFrameTime = timestamp - (delta % frameInterval);
      this.frameCount++;

      if (this.background) {
        this.background.render();
      }

      if (this.cards) {
        this.cards.update();
      }
    }

    requestAnimationFrame((t) => this.animate(t));
  }

  reinit() {
    // Cleanup old instances
    if (this.constellation) this.constellation.destroy();
    if (this.flyingIcons) this.flyingIcons.destroy();

    // Reinitialize for new page
    this.cards = new Cards3D();
    this.constellation = new ConstellationText();
    this.flyingIcons = new FlyingIcons();
  }
}

// ============================================================================
// INIT
// ============================================================================

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.body.classList.add('reduced-motion');
} else {
  window.experience = new Experience();
}
