// Constellation Text Shaders - GPU particle text rendering

export const constellationVertexShader = `
  precision highp float;

  attribute vec2 position;
  attribute float pointIndex;
  attribute float birthTime;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uFadeProgress;
  uniform float uPointSize;

  varying float vAlpha;
  varying float vPointIndex;

  void main() {
    // Staggered fade in based on point index
    float staggerDelay = pointIndex * 0.003;
    float fadeIn = smoothstep(0.0, 0.3, uTime - birthTime - staggerDelay);
    float fadeOut = 1.0 - smoothstep(0.0, 0.5, uFadeProgress);

    vAlpha = fadeIn * fadeOut;
    vPointIndex = pointIndex;

    // Convert pixel position to clip space
    vec2 clipPos = (position / uResolution) * 2.0 - 1.0;
    clipPos.y *= -1.0;

    gl_Position = vec4(clipPos, 0.0, 1.0);
    gl_PointSize = uPointSize * (0.8 + 0.4 * sin(uTime * 3.0 + pointIndex * 0.5));
  }
`;

export const constellationFragmentShader = `
  precision highp float;

  varying float vAlpha;
  varying float vPointIndex;

  uniform float uTime;

  void main() {
    // Circular point with soft edge
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

    // Color cycling
    float hue = mod(vPointIndex * 0.02 + uTime * 0.2, 1.0);
    vec3 color;

    // Simple HSV to RGB for cyan-green-blue range
    float h = hue * 0.3 + 0.45; // 0.45-0.75 = cyan to purple
    float s = 0.7;
    float v = 1.0;

    float c = v * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = v - c;

    if (h < 0.5) {
      color = vec3(0.0, c, x);
    } else if (h < 0.6667) {
      color = vec3(x, 0.0, c);
    } else {
      color = vec3(c, 0.0, x);
    }
    color += m;

    // Twinkle effect
    float twinkle = 0.7 + 0.3 * sin(uTime * 5.0 + vPointIndex * 1.5);

    gl_FragColor = vec4(color * twinkle, alpha * vAlpha * 0.9);
  }
`;

export const constellationLineVertexShader = `
  precision highp float;

  attribute vec2 position;
  attribute float lineIndex;
  attribute float birthTime;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uFadeProgress;

  varying float vAlpha;
  varying float vLineIndex;

  void main() {
    // Staggered fade in
    float staggerDelay = lineIndex * 0.002;
    float fadeIn = smoothstep(0.0, 0.4, uTime - birthTime - staggerDelay);
    float fadeOut = 1.0 - smoothstep(0.0, 0.4, uFadeProgress);

    vAlpha = fadeIn * fadeOut;
    vLineIndex = lineIndex;

    vec2 clipPos = (position / uResolution) * 2.0 - 1.0;
    clipPos.y *= -1.0;

    gl_Position = vec4(clipPos, 0.0, 1.0);
  }
`;

export const constellationLineFragmentShader = `
  precision highp float;

  varying float vAlpha;
  varying float vLineIndex;

  uniform float uTime;

  void main() {
    // Pulsing line color
    float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + vLineIndex * 0.3);

    vec3 color = mix(
      vec3(0.2, 0.8, 0.6), // Cyan
      vec3(0.6, 0.3, 1.0), // Purple
      pulse
    );

    gl_FragColor = vec4(color, vAlpha * 0.3);
  }
`;
