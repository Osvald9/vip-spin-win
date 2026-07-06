let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, at: number, dur = 0.08, type: OscillatorType = "square", gain = 0.08) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export function playSpinTicks(durationMs: number) {
  const ticks = Math.floor(durationMs / 90);
  for (let i = 0; i < ticks; i++) {
    tone(600 + (i % 6) * 40, (i * 90) / 1000, 0.04, "square", 0.05);
  }
}

export function playWin() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((n, i) => tone(n, i * 0.12, 0.18, "triangle", 0.09));
}

export function playLose() {
  tone(300, 0, 0.2, "sawtooth", 0.06);
  tone(200, 0.18, 0.3, "sawtooth", 0.06);
}
