#!/usr/bin/env node
/** Original offline synthesis: no samples or downloads; local ffmpeg/libmp3lame compression.
 * Run: node scripts/generate-audio.mjs; validate reproducibility: append --check.
 * All timing/noise is deterministic; manifest deliberately makes no license grant.
 */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUTPUT = fileURLToPath(new URL('../public/audio/', import.meta.url));
const RATE = 24000;
const SEED = 0x1a221a;
const TAU = Math.PI * 2;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function random(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
function buffer(seconds, channels = 1) {
  return Array.from({ length: channels }, () => new Float64Array(Math.round(seconds * RATE)));
}
// Periodic placement allows the previous loop's decays/reverb to enter at frame zero.
function note(out, start, duration, midi, gain, kind = 'felt', pan = 0) {
  const count = Math.ceil(duration * RATE);
  const frequency = hz(midi);
  const n = out[0].length;
  const left = out.length === 1 ? 1 : Math.sqrt((1 - pan) / 2);
  const right = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i++) {
    const t = i / RATE;
    const release = Math.min(1, Math.max(0, (duration - t) / (kind === 'pad' ? 0.8 : 0.045)));
    let envelope, sample;
    if (kind === 'pad') {
      envelope = Math.min(1, t / 0.7) * release * (0.86 + 0.14 * Math.sin(TAU * t / 4));
      sample = 0.7 * Math.sin(TAU * frequency * t) + 0.18 * Math.sin(TAU * frequency * 2 * t) + 0.08 * Math.sin(TAU * frequency * 3 * t);
    } else if (kind === 'bass') {
      envelope = Math.min(1, t / 0.035) * Math.exp(-t / 0.85) * release;
      sample = Math.sin(TAU * frequency * t) + 0.16 * Math.sin(TAU * frequency * 2 * t);
    } else {
      envelope = (1 - Math.exp(-t / 0.006)) * Math.exp(-t / 0.52) * release;
      sample = Math.sin(TAU * frequency * t) + 0.23 * Math.exp(-t / 0.14) * Math.sin(TAU * frequency * 2 * t) + 0.09 * Math.exp(-t / 0.08) * Math.sin(TAU * frequency * 3 * t);
    }
    const value = sample * envelope * gain;
    const index = ((Math.round(start * RATE) + i) % n + n) % n;
    out[0][index] += value * left;
    if (out.length === 2) out[1][index] += value * right;
  }
}
function percussion(out, start, gain, seed, kick = false) {
  const rng = random(seed);
  let smooth = 0;
  const duration = kick ? 0.28 : 0.14;
  for (let i = 0; i < duration * RATE; i++) {
    const t = i / RATE;
    smooth += ((rng() * 2 - 1) - smooth) * 0.17;
    const sound = kick ? Math.sin(TAU * (51 * t + 20 * 0.025 * (1 - Math.exp(-t / 0.025)))) : smooth;
    const value = sound * Math.min(1, t / 0.005) * Math.exp(-t / (kick ? 0.055 : 0.032)) * gain;
    const index = (Math.round(start * RATE) + i) % out[0].length;
    for (const channel of out) channel[index] += value;
  }
}
function ambience(out, circular) {
  const dry = out.map((channel) => channel.slice());
  // Soft, cross-fed early reflections and diffuse decays, all integral frames.
  for (const [seconds, gain] of [[0.113, 0.15], [0.197, 0.12], [0.307, 0.09], [0.449, 0.065], [0.673, 0.04], [0.911, 0.025]]) {
    const shift = Math.round(seconds * RATE);
    for (let c = 0; c < out.length; c++) {
      const source = dry[(c + 1) % dry.length];
      for (let i = 0; i < source.length; i++) {
        const destination = i + shift;
        if (circular || destination < source.length) out[c][destination % source.length] += source[i] * gain;
      }
    }
  }
}
function music() {
  const out = buffer(48, 2);
  // 80 BPM, 16 bars: warm major-seventh/suspended voicings, two related phrases.
  const chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 60],
    [48, 55, 59, 62], [45, 52, 57, 60], [41, 48, 55, 57], [43, 50, 53, 59]];
  const melody = [[76, 79], [72, 76], [69, 72], [74, 71], [79, 76], [72, 69], [77, 76], [74, 71],
    [76, 74], [72, 76], [69, 67], [71, 74], [79, 83], [81, 76], [77, 72], [74, 71]];
  for (let bar = 0; bar < 16; bar++) {
    const start = bar * 3;
    const chord = chords[bar % 8];
    chord.forEach((pitch, voice) => note(out, start - 0.2, 3.85, pitch + 12, 0.043, 'pad', (voice - 1.5) * 0.36));
    note(out, start, 1.8, chord[0] - 12, 0.12, 'bass', -0.08);
    note(out, start + 1.5, 1.35, chord[0] - 12, 0.075, 'bass', -0.08);
    melody[bar].forEach((pitch, index) => note(out, start + (index ? 2.25 : 0.75), 2.1, pitch, 0.11, 'felt', index ? 0.25 : -0.25));
    // Quiet off-beat chord answers; leave air around the melody.
    if (bar % 2 === 1) chord.slice(1, 3).forEach((pitch, index) => note(out, start + 1.875 + index * 0.035, 1.1, pitch + 12, 0.032, 'felt', -0.4));
    percussion(out, start, 0.035, SEED + bar, true);
    percussion(out, start + 1.5, 0.035, SEED + 40 + bar, true);
    for (let beat = 0; beat < 4; beat++) percussion(out, start + beat * 0.75 + 0.375, 0.04, SEED + bar * 8 + beat);
  }
  ambience(out, true);
  return out;
}
const definitions = [
  ['ui-confirm', 0.45, [[0, 76], [0.065, 79]], 'UI selection accepted'],
  ['ui-back', 0.45, [[0, 72], [0.08, 67]], 'Return or close UI'],
  ['ui-denied', 0.5, [[0, 57], [0.1, 56]], 'Unavailable action or rejected gear change'],
  ['gear-shift', 0.32, [[0, 48]], 'Successful gear transition; soft mechanical tap'],
  ['parking-success', 1.5, [[0, 72], [0.13, 76], [0.27, 79]], 'Parking capture completed'],
  ['timer-warning', 0.9, [[0, 76], [0.26, 76]], 'Timer urgency level changed'],
  ['penalty', 0.85, [[0, 64], [0.17, 60]], 'New assessment deduction; not a collision recording'],
  ['course-pass', 2.2, [[0, 60], [0.12, 64], [0.25, 67], [0.48, 72]], 'Individual course passed'],
  ['course-fail', 1.7, [[0, 64], [0.22, 60], [0.44, 57]], 'Individual course failed; restrained descending phrase'],
  ['exam-complete', 3.0, [[0, 60], [0.12, 64], [0.24, 67], [0.48, 72], [0.8, 76], [1.12, 79]], 'Continuous exam final completion'],
];
function cue(name, duration, notes) {
  const out = buffer(duration);
  notes.forEach(([start, pitch]) => note(out, start, Math.min(1.15, duration - start), pitch, 0.3));
  if (name === 'gear-shift') percussion(out, 0, 0.16, SEED + 400);
  ambience(out, false);
  // Every one-shot fades fully to silence (including reflections).
  const fade = Math.round(0.065 * RATE);
  for (let i = 0; i < fade; i++) out[0][out[0].length - fade + i] *= (1 - i / (fade - 1)) ** 2;
  return out;
}
function engineStart() {
  const out = buffer(1.6);
  const rng = random(SEED + 900);
  let phase = 0, noise = 0;
  for (let i = 0; i < out[0].length; i++) {
    const t = i / RATE;
    const frequency = 28 + 19 * (1 - Math.exp(-t / 0.26));
    phase += TAU * frequency / RATE;
    noise += (rng() * 2 - 1 - noise) * 0.08;
    const envelope = Math.min(1, t / 0.12) * Math.min(1, (1.6 - t) / 0.45);
    out[0][i] = envelope * (0.13 * Math.sin(phase) + 0.08 * Math.sin(phase * 2) + 0.025 * noise);
  }
  return out;
}
function encode(channels, peakTarget) {
  const length = channels[0].length;
  let peak = 0;
  for (const channel of channels) for (const value of channel) {
    if (!Number.isFinite(value)) throw new Error('Non-finite synthesized sample');
    peak = Math.max(peak, Math.abs(value));
  }
  const scale = peakTarget / Math.max(peak, 0.000001);
  const bytes = Buffer.alloc(44 + length * channels.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels.length, 22);
  bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * channels.length * 2, 28);
  bytes.writeUInt16LE(channels.length * 2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  let sumSquares = 0, maximum = 0, seam = 0, maxAdjacentDelta = 0;
  for (let i = 0; i < length; i++) for (let c = 0; c < channels.length; c++) {
    const value = Math.round(channels[c][i] * scale * 32767);
    bytes.writeInt16LE(value, 44 + (i * channels.length + c) * 2);
    maximum = Math.max(maximum, Math.abs(value) / 32768);
    if (i > 0) maxAdjacentDelta = Math.max(maxAdjacentDelta, Math.abs(value - bytes.readInt16LE(44 + ((i - 1) * channels.length + c) * 2)) / 32768);
    sumSquares += (value / 32768) ** 2;
    if (i === length - 1) seam = Math.max(seam, Math.abs(value - bytes.readInt16LE(44 + c * 2)) / 32768);
  }
  return { bytes, peak: maximum, rms: Math.sqrt(sumSquares / (length * channels.length)), seam, maxAdjacentDelta };
}
export async function generate(check = false) {
  const tracks = [
    ['menu-music', music(), 'Menu, briefing and quiet free-practice music', true],
    ...definitions.map(([name, duration, notes, purpose]) => [name, cue(name, duration, notes), purpose, false]),
    ['engine-start', engineStart(), 'Original synthesized ignition transition; not a real vehicle recording', false],
  ];
  const assets = [];
  let totalBytes = 0;
  if (!check) await mkdir(OUTPUT, { recursive: true });
  const scratch = await mkdtemp(path.join(path.dirname(OUTPUT), '.audio-temp-'));
  try {
  for (const [event, samples, purpose, loop] of tracks) {
    const { bytes, peak, rms, seam, maxAdjacentDelta } = encode(samples, loop ? 0.58 : event === 'engine-start' ? 0.38 : 0.46);
    // A healthy periodic waveform need not have identical first/last samples:
    // its wrap step must be within ordinary adjacent-sample slope, not an extra jump.
    if (peak >= 0.95 || rms < 0.001 || (loop && (seam > 0.035 || seam > maxAdjacentDelta * 1.05))) throw new Error(`Audio validation failed: ${event} peak=${peak} rms=${rms} seam=${seam}`);
    const filename = `${event}.mp3`;
    const wav = path.join(scratch, `${event}.wav`);
    const mp3 = path.join(scratch, filename);
    await writeFile(wav, bytes);
    execFileSync(process.env.FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', loop ? '128k' : '96k', '-write_xing', '1', mp3]);
    const compressed = await readFile(mp3);
    const target = path.join(OUTPUT, filename);
    if (check) {
      if (!(await readFile(target)).equals(compressed)) throw new Error(`Non-reproducible asset: ${filename}`);
    } else await writeFile(target, compressed);
    totalBytes += compressed.length;
    assets.push({ event, file: filename, purpose, format: 'MP3 (libmp3lame)', bitrateKbps: loop ? 128 : 96, sampleRate: RATE,
      channels: samples.length, durationSeconds: samples[0].length / RATE, loop, bytes: compressed.length, sha256: hash(compressed), sourcePcmSha256: hash(bytes),
      ...(loop ? { loopStartSeconds: 0, loopEndSeconds: samples[0].length / RATE } : {}),
      metricSource: 'original PCM before lossy MP3 encoding; decoded Chrome metrics recorded separately by verify-audio-offline.mjs',
      peak: Number(peak.toFixed(6)), rms: Number(rms.toFixed(6)), ...(loop ? { boundaryDelta: Number(seam.toFixed(6)), maxAdjacentDelta: Number(maxAdjacentDelta.toFixed(6)), boundaryWithinNormalSlope: seam <= maxAdjacentDelta * 1.05 } : {}) });
  }
  const manifest = {
    schemaVersion: 2, encoder: 'ffmpeg/libmp3lame; 128 kbps stereo music, 96 kbps mono cues; Xing gapless metadata', source: 'Original procedural composition and sound design synthesized exclusively by scripts/generate-audio.mjs. No third-party samples or recordings; no claim of authentic Ferrari sound. This manifest does not grant an additional license.',
    generator: 'scripts/generate-audio.mjs', generatorSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    seed: SEED, regeneration: 'node scripts/generate-audio.mjs', validation: 'node scripts/generate-audio.mjs --check',
    composition: { title: 'Sage Circuit', bpm: 80, bars: 16, timeSignature: '4/4', durationSeconds: 48,
      layers: ['warm four-voice changing harmony', 'rounded bass', 'sparse felt-key melody', 'off-beat chord answers', 'soft kick and brushed noise', 'circular stereo reflections'],
      looping: 'Notes and reflection tails are mixed periodically over the full loop; no silence gap or fade restart.' },
    totalAudioBytes: totalBytes, assets,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  if (totalBytes + manifestBytes.length >= 8 * 1024 * 1024) throw new Error('Audio pack exceeds 8 MiB');
  const manifestPath = path.join(OUTPUT, 'manifest.json');
  if (check) {
    if (!(await readFile(manifestPath)).equals(manifestBytes)) throw new Error('Manifest mismatch');
  } else await writeFile(manifestPath, manifestBytes);
  console.log(`${check ? 'Validated reproducible' : 'Generated'} ${assets.length} MP3 files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB; music 48 seconds, boundary delta ${assets[0].boundaryDelta}.`);
  return manifest;
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generate(process.argv.includes('--check')).catch((error) => { console.error(error); process.exitCode = 1; });
}
