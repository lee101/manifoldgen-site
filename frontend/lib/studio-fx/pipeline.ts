import { FX_BY_TYPE, type StudioFxLayer, type StudioFxType } from './registry';
import { FX_VERTEX, fxFragmentSource } from './shaders';

type Target = { texture: WebGLTexture; framebuffer: WebGLFramebuffer };
type HistoryEntry = Target & { width: number; height: number; time: number };
type FxProgram = { program: WebGLProgram; image: WebGLUniformLocation | null; prev: WebGLUniformLocation | null; resolution: WebGLUniformLocation | null; time: WebGLUniformLocation | null; hasPrev: WebGLUniformLocation | null; mix: WebGLUniformLocation | null; params: WebGLUniformLocation | null };

const HISTORY_LIMIT = 24;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'FX shader compilation failed');
  return shader;
}

export class StudioFxPipeline {
  private programs = new Map<StudioFxType, FxProgram>();
  private vao: WebGLVertexArrayObject;
  private buffer: WebGLBuffer;
  private targets: Target[] = [];
  private width = 0;
  private height = 0;
  private history = new Map<string, HistoryEntry>();

  constructor(private gl: WebGL2RenderingContext) {
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error('Unable to start the FX pipeline');
    this.vao = vao;
    this.buffer = buffer;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  private createTarget(width: number, height: number): Target {
    const { gl } = this;
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) throw new Error('Unable to allocate an FX buffer');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, framebuffer };
  }

  private deleteTarget(target: Target) {
    this.gl.deleteTexture(target.texture);
    this.gl.deleteFramebuffer(target.framebuffer);
  }

  private program(type: StudioFxType) {
    const cached = this.programs.get(type);
    if (cached) return cached;
    const { gl } = this;
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create FX program');
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, FX_VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fxFragmentSource(type)));
    gl.bindAttribLocation(program, 0, 'a_position');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'FX program link failed');
    const entry: FxProgram = {
      program,
      image: gl.getUniformLocation(program, 'u_image'),
      prev: gl.getUniformLocation(program, 'u_prev'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      hasPrev: gl.getUniformLocation(program, 'u_hasPrev'),
      mix: gl.getUniformLocation(program, 'u_mix'),
      params: gl.getUniformLocation(program, 'u_p'),
    };
    this.programs.set(type, entry);
    return entry;
  }

  begin(width: number, height: number) {
    if (width !== this.width || height !== this.height || !this.targets.length) {
      this.targets.forEach((target) => this.deleteTarget(target));
      this.targets = [this.createTarget(width, height), this.createTarget(width, height)];
      this.width = width;
      this.height = height;
    }
    return this.targets[0].framebuffer;
  }

  private historyFor(key: string, time: number) {
    const { gl } = this;
    let entry = this.history.get(key);
    const fresh = !entry || entry.width !== this.width || entry.height !== this.height || time < entry.time - 1e-3 || time - entry.time > 0.5;
    if (entry && (entry.width !== this.width || entry.height !== this.height)) {
      this.deleteTarget(entry);
      this.history.delete(key);
      entry = undefined;
    }
    if (!entry) {
      entry = { ...this.createTarget(this.width, this.height), width: this.width, height: this.height, time };
      this.history.set(key, entry);
      while (this.history.size > HISTORY_LIMIT) {
        const [oldest, value] = this.history.entries().next().value as [string, HistoryEntry];
        this.deleteTarget(value);
        this.history.delete(oldest);
      }
    } else {
      this.history.delete(key);
      this.history.set(key, entry);
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    return { entry, fresh };
  }

  run(layers: StudioFxLayer[], options: { time: number; stateKey: string }) {
    const { gl } = this;
    let source = 0;
    gl.bindVertexArray(this.vao);
    for (const layer of layers) {
      const definition = FX_BY_TYPE[layer.type];
      const target = 1 - source;
      const fx = this.program(layer.type);
      let history: { entry: HistoryEntry; fresh: boolean } | null = null;
      if (definition.history) {
        gl.activeTexture(gl.TEXTURE1);
        history = this.historyFor(`${options.stateKey}:${layer.id}`, options.time);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[target].framebuffer);
      gl.viewport(0, 0, this.width, this.height);
      gl.useProgram(fx.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.targets[source].texture);
      gl.uniform1i(fx.image, 0);
      gl.uniform1i(fx.prev, 1);
      gl.uniform2f(fx.resolution, this.width, this.height);
      gl.uniform1f(fx.time, options.time);
      gl.uniform1f(fx.hasPrev, history && !history.fresh ? 1 : 0);
      gl.uniform1f(fx.mix, layer.params.mix ?? 1);
      const params = new Float32Array(8);
      definition.uniforms.forEach((key, index) => { params[index] = layer.params[key] ?? definition.defaults[key] ?? 0; });
      gl.uniform1fv(fx.params, params);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (history) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.targets[target].framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, history.entry.framebuffer);
        gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        history.entry.time = options.time;
      }
      source = target;
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.targets[source].framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  resetHistory(prefix?: string) {
    for (const [key, entry] of [...this.history]) {
      if (prefix && !key.startsWith(`${prefix}:`)) continue;
      this.deleteTarget(entry);
      this.history.delete(key);
    }
  }

  destroy() {
    this.targets.forEach((target) => this.deleteTarget(target));
    this.targets = [];
    this.resetHistory();
    this.programs.forEach((entry) => this.gl.deleteProgram(entry.program));
    this.programs.clear();
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteVertexArray(this.vao);
  }
}
