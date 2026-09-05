import fs from "fs";
import path from "path";

const SR = 44100;

function writeWav(filename, samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  }
  fs.writeFileSync(filename, buf);
  console.log("wrote", filename, samples.length, "samples");
}

// simple wave shapes
const sine = (t, f) => Math.sin(2 * Math.PI * f * t);
const triangle = (t, f) => {
  const x = t * f - Math.floor(t * f + 0.5);
  return 2 * Math.abs(2 * x) - 1;
};

function tone(freqFn, durSec, shape, peakGain, attack = 0.004) {
  const n = Math.floor(SR * durSec);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freqFn(t);
    const env =
      t < attack
        ? t / attack
        : Math.exp(-((t - attack) / (durSec - attack)) * 5.2);
    out[i] = shape(t, f) * env * peakGain;
  }
  return out;
}

function concat(...arrs) {
  return arrs.flat();
}
function silence(durSec) {
  return new Array(Math.floor(SR * durSec)).fill(0);
}

const outDir = "/home/claude/rn-build/assets/sfx";
fs.mkdirSync(outDir, { recursive: true });

// tick: light "about to catch" cue while dragging near a valid peg
writeWav(path.join(outDir, "tick.wav"), tone(() => 900, 0.035, sine, 0.35, 0.002));

// commit: the satisfying "thunk" when a band snaps onto a peg and the move commits
writeWav(
  path.join(outDir, "commit.wav"),
  tone(() => 220, 0.1, triangle, 0.5, 0.003)
);

// retract: soft downward blip when a stretch is released with no valid target
writeWav(
  path.join(outDir, "retract.wav"),
  tone((t) => 260 - t * 900, 0.09, sine, 0.32, 0.002)
);

// claim: ascending 3-note chime baked into one file (mirrors the web version's staggered blips)
const notes = [520, 660, 780];
const noteDur = 0.11;
const gap = 0.015;
let claimSamples = [];
notes.forEach((f, i) => {
  claimSamples = concat(claimSamples, tone(() => f, noteDur, sine, 0.42, 0.003));
  if (i < notes.length - 1) claimSamples = concat(claimSamples, silence(gap));
});
writeWav(path.join(outDir, "claim.wav"), claimSamples);

console.log("done");
