/*
 * Adapted for vanilla JavaScript from ElevenLabs UI's LiveWaveform component.
 * Source: https://github.com/elevenlabs/ui
 * License: MIT
 */
export class ElevenLabsLiveWaveform {
  constructor(canvas) {
    this.canvas = null;
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.audioContext = null;
    this.resizeObserver = null;
    this.active = false;
    this.processing = false;
    this.frame = 0;
    this.lastUpdate = 0;
    this.values = [];
    this.attach(canvas);
    this.animate = this.animate.bind(this);
    this.frame = requestAnimationFrame(this.animate);
  }

  attach(canvas) {
    if (this.canvas === canvas) return;
    this.detach();
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  detach() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.canvas = null;
    this.context = null;
  }

  update({ active, processing, stream }) {
    this.active = Boolean(active);
    this.processing = Boolean(processing);
    if (stream !== this.stream) this.setStream(stream);
  }

  setStream(stream) {
    this.source?.disconnect();
    this.source = null;
    this.analyser = null;
    if (this.audioContext && this.audioContext.state !== 'closed') void this.audioContext.close();
    this.audioContext = null;
    this.stream = stream || null;
    if (!this.stream) return;

    this.audioContext = new AudioContext();
    void this.audioContext.resume();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
  }

  resize() {
    if (!this.canvas || !this.context) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * scale));
    this.canvas.height = Math.max(1, Math.round(rect.height * scale));
    this.context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  audioValues(count) {
    if (!this.analyser || !this.active) return null;
    const frequencies = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencies);
    const start = Math.floor(frequencies.length * 0.05);
    const end = Math.floor(frequencies.length * 0.4);
    const values = [];
    for (let index = 0; index < count; index += 1) {
      const sourceIndex = start + Math.floor((index / count) * (end - start));
      values.push(Math.max(0.05, frequencies[sourceIndex] / 255));
    }
    return values;
  }

  processingValues(count, time) {
    return Array.from({ length: count }, (_, index) => {
      const position = (index - count / 2) / (count / 2);
      const centerWeight = 1 - Math.abs(position) * 0.4;
      const wave = Math.sin(time * 0.002 + position * 3) * 0.21
        + Math.sin(time * 0.0011 - position * 2) * 0.16
        + Math.cos(time * 0.0022 + position) * 0.12;
      return Math.max(0.06, Math.min(0.72, (0.24 + wave) * centerWeight));
    });
  }

  animate(time) {
    if (this.canvas && this.context) this.draw(time);
    this.frame = requestAnimationFrame(this.animate);
  }

  draw(time) {
    const rect = this.canvas.getBoundingClientRect();
    const { context } = this;
    context.clearRect(0, 0, rect.width, rect.height);
    const barWidth = 3;
    const barGap = 2;
    const count = Math.max(1, Math.floor(rect.width / (barWidth + barGap)));
    if (this.active && time - this.lastUpdate > 30) {
      this.lastUpdate = time;
      this.values = this.audioValues(count) || this.values;
    } else if (this.processing && !this.active) {
      this.values = this.processingValues(count, time);
    } else if (!this.active) {
      this.values = Array.from({ length: count }, () => 0.04);
    }

    const values = this.values.length === count ? this.values : Array.from({ length: count }, (_, index) => this.values[index % Math.max(1, this.values.length)] || 0.04);
    const centerY = rect.height / 2;
    values.forEach((value, index) => {
      const edge = Math.min(1, Math.min(index / 8, (count - index - 1) / 8));
      const height = Math.max(4, value * rect.height * 0.8);
      context.globalAlpha = (0.35 + value * 0.65) * edge;
      context.fillStyle = '#111';
      context.beginPath();
      context.roundRect(index * (barWidth + barGap), centerY - height / 2, barWidth, height, 1.5);
      context.fill();
    });
    context.globalAlpha = 1;
  }
}
