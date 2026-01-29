// Flying Icons Shaders - GPU glowing particles with trails

export const flyingIconsVertexShader = `
  precision highp float;

  attribute vec2 position;
  attribute vec2 instanceOffset;
  attribute vec4 bezierX;
  attribute vec4 bezierY;
  attribute float pathProgress;
  attribute float iconType;

  uniform float uTime;
  uniform vec2 uResolution;

  varying float vIconType;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vTrailIndex;

  // Cubic bezier interpolation
  float bezier(float t, vec4 p) {
    float t2 = t * t;
    float t3 = t2 * t;
    float mt = 1.0 - t;
    float mt2 = mt * mt;
    float mt3 = mt2 * mt;
    return mt3 * p.x + 3.0 * mt2 * t * p.y + 3.0 * mt * t2 * p.z + t3 * p.w;
  }

  void main() {
    // Calculate position along bezier path
    float t = mod(pathProgress + uTime * 0.04, 1.0);

    // Trail effect - offset earlier instances behind
    float trailOffset = instanceOffset.y * 0.02;
    float trailT = max(0.0, t - trailOffset);

    float x = bezier(trailT, bezierX);
    float y = bezier(trailT, bezierY);

    // Particle size (smaller for trails)
    float baseSize = 20.0;
    float size = baseSize * (1.0 - instanceOffset.y * 0.2);

    // Convert to clip space
    vec2 pos = vec2(x, y) + position * size;
    vec2 clipPos = (pos / uResolution) * 2.0 - 1.0;
    clipPos.y *= -1.0;

    gl_Position = vec4(clipPos, 0.0, 1.0);

    vIconType = iconType;
    vUv = position * 0.5 + 0.5;
    vAlpha = 1.0 - instanceOffset.y * 0.25;
    vTrailIndex = instanceOffset.y;
  }
`;

export const flyingIconsFragmentShader = `
  precision highp float;

  varying float vIconType;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vTrailIndex;

  uniform float uTime;

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float dist = length(uv);

    // Soft glowing circle
    float core = 1.0 - smoothstep(0.0, 0.3, dist);
    float glow = exp(-dist * 2.5) * 0.8;
    float alpha = core + glow;

    // Color based on icon type with time variation
    float hue = mod(vIconType * 0.15 + uTime * 0.1, 1.0);

    // HSV to RGB (cyan to magenta range)
    vec3 color;
    float h = hue * 0.5 + 0.4; // 0.4-0.9 range (cyan/blue/purple/magenta)

    // Simplified HSV to RGB
    vec3 c1 = vec3(0.3, 0.8, 1.0);  // Cyan
    vec3 c2 = vec3(0.6, 0.4, 1.0);  // Purple
    vec3 c3 = vec3(1.0, 0.4, 0.8);  // Magenta

    float colorMix = sin(uTime * 0.5 + vIconType * 2.0) * 0.5 + 0.5;
    color = mix(c1, c2, colorMix);
    color = mix(color, c3, sin(uTime * 0.3 + vIconType) * 0.3 + 0.2);

    // Trails are more transparent and slightly shifted color
    color = mix(color, c1, vTrailIndex * 0.4);

    // Pulsing brightness
    float pulse = 0.8 + 0.2 * sin(uTime * 3.0 + vIconType * 1.5);
    color *= pulse;

    // Final alpha
    float finalAlpha = alpha * vAlpha * 0.85;

    // Discard nearly transparent pixels
    if (finalAlpha < 0.01) discard;

    gl_FragColor = vec4(color, finalAlpha);
  }
`;
