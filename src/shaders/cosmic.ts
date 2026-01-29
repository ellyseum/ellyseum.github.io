export const vertexShader = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export const fragmentShader = `
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
      // Unique random values per star for truly independent animation
      float h2 = hash(id + 127.1);
      float h3 = hash(id + 311.7);
      // Each star gets unique speed (0.3-3x) and phase (0-2PI)
      float t1 = sin(uTime * (0.3 + h * 2.7) + h * 62.83);
      float t2 = sin(uTime * (0.5 + h2 * 2.5) + h2 * 47.12);
      float t3 = sin(uTime * (0.8 + h3 * 3.2) + h3 * 31.42);
      float flicker = 0.15 + 0.85 * ((t1 * 0.5 + t2 * 0.3 + t3 * 0.2) * 0.5 + 0.5);
      return smoothstep(0.06, 0.0, d) * brightness * flicker;
    }
    return 0.0;
  }

  // Bright stars with sparkle/diffraction spikes
  float brightStar(vec2 uv, float density, float brightness) {
    vec2 gv = fract(uv * density) - 0.5;
    vec2 id = floor(uv * density);
    float h = hash(id);

    if (h > 0.94) {
      // Unique random values per star
      float h2 = hash(id + 237.5);
      float h3 = hash(id + 419.3);
      // Each star gets unique speed and phase
      float t1 = sin(uTime * (0.2 + h * 1.8) + h * 94.25);
      float t2 = sin(uTime * (0.4 + h2 * 2.1) + h2 * 62.83);
      float t3 = sin(uTime * (0.7 + h3 * 1.5) + h3 * 47.12);
      float twinkle = 0.15 + 0.85 * ((t1 * 0.5 + t2 * 0.35 + t3 * 0.15) * 0.5 + 0.5);

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
