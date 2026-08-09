export type StudioAdjustments = {
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  temperature: number;
  tint: number;
  fade: number;
  vignette: number;
  grain: number;
};

export const DEFAULT_ADJUSTMENTS: StudioAdjustments = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
};

const VERTEX = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_exposure;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
uniform float u_fade;
uniform float u_vignette;
uniform float u_grain;
uniform float u_seed;
in vec2 v_texCoord;
out vec4 outColor;

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + u_seed) * 43758.5453);
}

void main() {
  vec4 sampleColor = texture(u_image, v_texCoord);
  vec3 color = sampleColor.rgb * exp2(u_exposure);
  color += u_brightness;
  color = (color - 0.5) * (1.0 + u_contrast) + 0.5;

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float shadowMask = 1.0 - smoothstep(0.05, 0.62, luma);
  float highlightMask = smoothstep(0.38, 0.95, luma);
  color += u_shadows * shadowMask * 0.45;
  color += u_highlights * highlightMask * 0.45;

  luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, 1.0 + u_saturation);
  color.r += u_temperature * 0.09;
  color.b -= u_temperature * 0.09;
  color.g += u_tint * 0.06;
  color = mix(color, vec3(0.5), u_fade * 0.22);

  vec2 uv = v_texCoord - 0.5;
  float edge = smoothstep(0.2, 0.72, length(uv));
  color *= 1.0 - edge * u_vignette * 0.78;
  color += (random(gl_FragCoord.xy) - 0.5) * u_grain * 0.12;
  outColor = vec4(clamp(color, 0.0, 1.0), sampleColor.a);
}`;

function makeShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
  }
  return shader;
}

export class StudioRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null>;

  constructor(public readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL 2 is required for Studio');
    this.gl = gl;
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program');
    gl.attachShader(program, makeShader(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, makeShader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed');
    }
    this.program = program;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]), gl.STATIC_DRAW);
    const texCoord = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texCoord);
    gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    if (!texture) throw new Error('Unable to create WebGL texture');
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.useProgram(program);

    const names = ['exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'saturation', 'temperature', 'tint', 'fade', 'vignette', 'grain', 'seed'];
    this.uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]));
    this.uniforms.resolution = gl.getUniformLocation(program, 'u_resolution');
  }

  resize(width: number, height: number) {
    const safeWidth = Math.max(2, Math.round(width / 2) * 2);
    const safeHeight = Math.max(2, Math.round(height / 2) * 2);
    if (this.canvas.width !== safeWidth) this.canvas.width = safeWidth;
    if (this.canvas.height !== safeHeight) this.canvas.height = safeHeight;
  }

  draw(source: TexImageSource, adjustments: StudioAdjustments, seed = 0) {
    const { gl } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    (Object.keys(DEFAULT_ADJUSTMENTS) as (keyof StudioAdjustments)[]).forEach((key) => {
      gl.uniform1f(this.uniforms[key], adjustments[key]);
    });
    gl.uniform1f(this.uniforms.seed, seed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  destroy() {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteProgram(this.program);
  }
}
