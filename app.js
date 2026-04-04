/* ============================================================
   MusiciAIn — Professional AI Music Composer Engine
   Real chord progressions, multi-layer composition,
   motif-based melody, tanpura drone, pro drum synthesis
   ============================================================ */
(function () {
  "use strict";

  /* ================================================================
     1. AUDIO ENGINE
     ================================================================ */
  let ctx = null;
  let masterGain = null;
  let analyser = null;
  let reverbNode = null;
  let delayNode = null;
  let delayFeedback = null;
  let delayWet = null;

  function initAudio() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.75;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
    buildReverb();
    buildDelay();
  }

  function buildReverb() {
    reverbNode = ctx.createConvolver();
    const len = ctx.sampleRate * 2.5;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
    }
    reverbNode.buffer = buf;
  }

  function buildDelay() {
    delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.value = 0.35;
    delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.3;
    delayWet = ctx.createGain();
    delayWet.gain.value = 0;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(masterGain);
  }

  /* ================================================================
     2. MUSIC THEORY ENGINE
     ================================================================ */
  const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function noteToMidi(note, octave) { return (octave + 1) * 12 + NOTES.indexOf(note); }

  const SCALES = {
    major:          [0,2,4,5,7,9,11],
    minor:          [0,2,3,5,7,8,10],
    harmonicMinor:  [0,2,3,5,7,8,11],
    melodicMinor:   [0,2,3,5,7,9,11],
    pentatonic:     [0,2,4,7,9],
    minorPentatonic:[0,3,5,7,10],
    blues:          [0,3,5,6,7,10],
    dorian:         [0,2,3,5,7,9,10],
    mixolydian:     [0,2,4,5,7,9,10],
    lydian:         [0,2,4,6,7,9,11],
    phrygian:       [0,1,3,5,7,8,10],
  };

  // Chord quality definitions (intervals from root)
  const CHORD_TYPES = {
    maj:  [0,4,7],
    min:  [0,3,7],
    dim:  [0,3,6],
    aug:  [0,4,8],
    sus2: [0,2,7],
    sus4: [0,5,7],
    maj7: [0,4,7,11],
    min7: [0,3,7,10],
    dom7: [0,4,7,10],
    dim7: [0,3,6,9],
  };

  // Diatonic chords for major scale: I ii iii IV V vi vii°
  function getDiatonicChords(rootNote, scaleType) {
    const scale = SCALES[scaleType] || SCALES.major;
    const root = NOTES.indexOf(rootNote);
    if (scale.length < 7) return getMajorDiatonic(rootNote); // fallback for pentatonic etc.

    const qualities = scaleType === "major" || scaleType === "lydian" || scaleType === "mixolydian"
      ? ["maj","min","min","maj","maj","min","dim"]
      : ["min","dim","maj","min","min","maj","maj"]; // minor-type

    return scale.map((interval, i) => ({
      root: (root + interval) % 12,
      quality: qualities[i] || "maj",
      degree: i + 1,
      notes: CHORD_TYPES[qualities[i]].map(n => (root + interval + n) % 12),
    }));
  }

  function getMajorDiatonic(rootNote) {
    return getDiatonicChords(rootNote, "major");
  }

  // Chord progressions per mood (using scale degrees, 1-indexed)
  const PROGRESSIONS = {
    happy:      [[1,5,6,4], [1,4,5,5], [1,4,6,5], [1,5,4,5]],
    sad:        [[1,6,4,5], [6,4,1,5], [1,4,6,4], [1,3,4,5]],
    romantic:   [[1,6,4,5], [1,3,4,5], [4,5,6,1], [1,5,6,4]],
    energetic:  [[1,5,6,4], [1,4,5,5], [6,4,1,5], [1,5,4,5]],
    calm:       [[1,4,1,5], [1,6,4,1], [4,1,5,1], [1,4,5,4]],
    melancholy: [[6,4,1,5], [1,6,3,4], [6,5,4,5], [1,4,6,5]],
    triumphant: [[1,5,6,4], [1,4,5,1], [4,5,1,1], [1,5,4,5]],
    mysterious: [[1,7,6,5], [1,2,4,5], [6,7,1,5], [1,4,7,6]],
    devotional: [[1,4,5,1], [1,5,4,1], [4,5,1,4], [1,4,1,5]],
    playful:    [[1,5,6,4], [1,4,5,4], [4,5,1,5], [1,6,4,5]],
    epic:       [[6,4,1,5], [1,5,6,4], [4,1,5,6], [6,5,4,1]],
    nostalgia:  [[1,6,4,5], [1,4,6,5], [4,1,5,6], [1,5,4,6]],
  };

  // Song structures
  const STRUCTURES = {
    short:    ["intro","verse","chorus","outro"],
    medium:   ["intro","verse","chorus","verse","chorus","bridge","chorus","outro"],
    long:     ["intro","verse","verse","chorus","verse","chorus","bridge","chorus","chorus","outro"],
  };

  /* ================================================================
     3. PROFESSIONAL SYNTH ENGINE
     ================================================================ */
  const INSTRUMENTS = {
    piano: {
      oscs: [{type:"triangle",detune:0,gain:0.6},{type:"sine",detune:1,gain:0.3},{type:"sine",detune:-700,gain:0.15}],
      attack:0.008, decay:0.25, sustain:0.35, release:0.3
    },
    synth: {
      oscs: [{type:"sawtooth",detune:0,gain:0.4},{type:"sawtooth",detune:7,gain:0.3},{type:"square",detune:-5,gain:0.15}],
      attack:0.03, decay:0.15, sustain:0.6, release:0.2
    },
    strings: {
      oscs: [{type:"sawtooth",detune:0,gain:0.25},{type:"sawtooth",detune:5,gain:0.25},{type:"sawtooth",detune:-5,gain:0.2},{type:"sine",detune:0,gain:0.15}],
      attack:0.12, decay:0.3, sustain:0.7, release:0.4
    },
    flute: {
      oscs: [{type:"sine",detune:0,gain:0.5},{type:"sine",detune:1200,gain:0.08},{type:"triangle",detune:0,gain:0.15}],
      attack:0.06, decay:0.1, sustain:0.55, release:0.2, vibrato:{rate:5,depth:4}
    },
    sitar: {
      oscs: [{type:"sawtooth",detune:0,gain:0.35},{type:"square",detune:1,gain:0.2},{type:"sawtooth",detune:1200,gain:0.1}],
      attack:0.003, decay:0.12, sustain:0.15, release:0.5, vibrato:{rate:5.5,depth:6}
    },
    pad: {
      oscs: [{type:"sine",detune:0,gain:0.3},{type:"triangle",detune:3,gain:0.2},{type:"sine",detune:-3,gain:0.2}],
      attack:0.3, decay:0.5, sustain:0.7, release:0.6
    },
    bass: {
      oscs: [{type:"sine",detune:0,gain:0.6},{type:"triangle",detune:0,gain:0.25},{type:"square",detune:0,gain:0.08}],
      attack:0.01, decay:0.15, sustain:0.5, release:0.12
    },
    arp: {
      oscs: [{type:"triangle",detune:0,gain:0.45},{type:"sine",detune:2,gain:0.2}],
      attack:0.005, decay:0.08, sustain:0.3, release:0.15
    },
  };

  function synthNote(freq, dur, instName, startTime, vol, useReverb) {
    if (!ctx) return;
    const t = startTime || ctx.currentTime;
    const v = vol || 0.25;
    const inst = INSTRUMENTS[instName] || INSTRUMENTS.piano;
    const envelope = ctx.createGain();

    // ADSR
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(v, t + inst.attack);
    envelope.gain.linearRampToValueAtTime(v * inst.sustain, t + inst.attack + inst.decay);
    const releaseStart = t + dur - inst.release;
    if (releaseStart > t + inst.attack + inst.decay) {
      envelope.gain.setValueAtTime(v * inst.sustain, releaseStart);
    }
    envelope.gain.linearRampToValueAtTime(0.001, t + dur);

    // Oscillators
    inst.oscs.forEach(osc_def => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = osc_def.type;
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime(osc_def.detune || 0, t);
      oscGain.gain.value = osc_def.gain;
      osc.connect(oscGain);
      oscGain.connect(envelope);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });

    // Vibrato
    if (inst.vibrato) {
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      vib.frequency.value = inst.vibrato.rate;
      vibGain.gain.value = inst.vibrato.depth;
      vib.connect(vibGain);
      inst.oscs.forEach((_, i) => {
        // Apply to first osc frequency
      });
      vib.start(t);
      vib.stop(t + dur + 0.05);
    }

    // Routing
    envelope.connect(masterGain);
    if (useReverb && reverbNode) {
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.15;
      envelope.connect(reverbNode);
      reverbNode.connect(wetGain);
      wetGain.connect(masterGain);
    }
  }

  /* ================================================================
     4. PROFESSIONAL DRUM SYNTHESIS
     ================================================================ */
  function synthDrum(type, time, vel) {
    if (!ctx) return;
    const t = time || ctx.currentTime;
    const v = vel || 0.7;

    switch (type) {
      case "kick": {
        // Body
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);
        g.gain.setValueAtTime(v, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + 0.4);
        // Click
        const click = ctx.createOscillator();
        const cg = ctx.createGain();
        click.type = "square";
        click.frequency.setValueAtTime(1500, t);
        click.frequency.exponentialRampToValueAtTime(200, t + 0.01);
        cg.gain.setValueAtTime(v * 0.4, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        click.connect(cg); cg.connect(masterGain);
        click.start(t); click.stop(t + 0.03);
        break;
      }
      case "snare": {
        // Body
        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.05);
        og.gain.setValueAtTime(v * 0.6, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(og); og.connect(masterGain);
        osc.start(t); osc.stop(t + 0.12);
        // Noise
        const noise = ctx.createBufferSource();
        const nb = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        noise.buffer = nb;
        const ng = ctx.createGain();
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 2000;
        ng.gain.setValueAtTime(v * 0.55, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        noise.connect(hp); hp.connect(ng); ng.connect(masterGain);
        noise.start(t); noise.stop(t + 0.18);
        break;
      }
      case "hihat": {
        const noise = ctx.createBufferSource();
        const nb = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        noise.buffer = nb;
        const g = ctx.createGain();
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 10000; bp.Q.value = 1;
        g.gain.setValueAtTime(v * 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        noise.connect(bp); bp.connect(g); g.connect(masterGain);
        noise.start(t); noise.stop(t + 0.04);
        break;
      }
      case "openhat": {
        const noise = ctx.createBufferSource();
        const nb = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        noise.buffer = nb;
        const g = ctx.createGain();
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 8000; bp.Q.value = 0.8;
        g.gain.setValueAtTime(v * 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        noise.connect(bp); bp.connect(g); g.connect(masterGain);
        noise.start(t); noise.stop(t + 0.25);
        break;
      }
      case "clap": {
        for (let i = 0; i < 4; i++) {
          const noise = ctx.createBufferSource();
          const nb = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
          const nd = nb.getChannelData(0);
          for (let j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
          noise.buffer = nb;
          const g = ctx.createGain();
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass"; bp.frequency.value = 2500; bp.Q.value = 0.5;
          const offset = i * 0.008;
          g.gain.setValueAtTime(v * 0.4, t + offset);
          g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.07);
          noise.connect(bp); bp.connect(g); g.connect(masterGain);
          noise.start(t + offset); noise.stop(t + offset + 0.07);
        }
        // Tail
        const tail = ctx.createBufferSource();
        const tb = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const td = tb.getChannelData(0);
        for (let i = 0; i < td.length; i++) td[i] = Math.random() * 2 - 1;
        tail.buffer = tb;
        const tg = ctx.createGain();
        const thp = ctx.createBiquadFilter();
        thp.type = "highpass"; thp.frequency.value = 1500;
        tg.gain.setValueAtTime(v * 0.25, t + 0.032);
        tg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        tail.connect(thp); thp.connect(tg); tg.connect(masterGain);
        tail.start(t + 0.032); tail.stop(t + 0.15);
        break;
      }
      case "tom": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.18);
        g.gain.setValueAtTime(v * 0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + 0.3);
        break;
      }
      case "rim": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.setValueAtTime(600, t + 0.005);
        g.gain.setValueAtTime(v * 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        osc.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + 0.03);
        break;
      }
      case "shaker": {
        const noise = ctx.createBufferSource();
        const nb = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.5;
        noise.buffer = nb;
        const g = ctx.createGain();
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 9000;
        g.gain.setValueAtTime(v * 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        noise.connect(hp); hp.connect(g); g.connect(masterGain);
        noise.start(t); noise.stop(t + 0.05);
        break;
      }
    }
  }

  /* ================================================================
     5. TANPURA DRONE ENGINE
     ================================================================ */
  let tanpuraOscs = [];
  let tanpuraGain = null;
  let tanpuraActive = false;

  function startTanpura(rootNote, volume) {
    stopTanpura();
    initAudio();
    tanpuraActive = true;
    const rootMidi = noteToMidi(rootNote, 3);
    const saFreq = midiToFreq(rootMidi);
    const paFreq = midiToFreq(rootMidi + 7); // Perfect 5th
    const saLowFreq = midiToFreq(rootMidi - 12); // Sa lower octave

    tanpuraGain = ctx.createGain();
    tanpuraGain.gain.value = volume;

    // 4-string tanpura: Pa, Sa, Sa, Sa(lower)
    const stringFreqs = [paFreq, saFreq, saFreq, saLowFreq];
    stringFreqs.forEach((freq, i) => {
      // Rich tanpura tone: fundamental + harmonics
      [1, 2, 3, 4, 5].forEach(harmonic => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * harmonic;
        oscGain.gain.value = (0.15 / harmonic) * (i === 3 ? 1.2 : 1); // bass string louder
        // Slow amplitude modulation for organic feel
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.15 + i * 0.05 + harmonic * 0.02;
        lfoGain.gain.value = oscGain.gain.value * 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);
        lfo.start();

        osc.connect(oscGain);
        oscGain.connect(tanpuraGain);
        osc.start();
        tanpuraOscs.push(osc, lfo);
      });
    });

    tanpuraGain.connect(masterGain);
  }

  function stopTanpura() {
    tanpuraActive = false;
    tanpuraOscs.forEach(o => { try { o.stop(); } catch(e) {} });
    tanpuraOscs = [];
    if (tanpuraGain) { try { tanpuraGain.disconnect(); } catch(e) {} tanpuraGain = null; }
  }

  /* ================================================================
     6. COMPOSITION AI ENGINE (Mood Composer)
     Proper music theory: voice leading, motif development,
     phrase structure, dynamics, tension/resolution
     ================================================================ */
  const MOOD_PROFILES = {
    happy:      { scale:"major",     tempo:128, octave:4, energy:0.8,  swing:0,   voicing:"open",  arpStyle:"up",    drumPattern:"pop",    instrument:"piano" },
    sad:        { scale:"minor",     tempo:76,  octave:3, energy:0.3,  swing:0.1, voicing:"close",  arpStyle:"down",  drumPattern:"ballad", instrument:"pad" },
    romantic:   { scale:"major",     tempo:88,  octave:4, energy:0.5,  swing:0.15,voicing:"spread", arpStyle:"updown",drumPattern:"ballad", instrument:"strings" },
    energetic:  { scale:"pentatonic",tempo:145, octave:4, energy:1.0,  swing:0,   voicing:"power",  arpStyle:"random",drumPattern:"drive",  instrument:"synth" },
    calm:       { scale:"pentatonic",tempo:68,  octave:4, energy:0.2,  swing:0.1, voicing:"open",   arpStyle:"up",    drumPattern:"none",   instrument:"pad" },
    melancholy: { scale:"minor",     tempo:72,  octave:3, energy:0.25, swing:0.15,voicing:"close",  arpStyle:"down",  drumPattern:"ballad", instrument:"strings" },
    triumphant: { scale:"major",     tempo:140, octave:4, energy:0.9,  swing:0,   voicing:"power",  arpStyle:"up",    drumPattern:"drive",  instrument:"piano" },
    mysterious: { scale:"phrygian",  tempo:84,  octave:3, energy:0.4,  swing:0.2, voicing:"close",  arpStyle:"random",drumPattern:"sparse", instrument:"pad" },
    devotional: { scale:"pentatonic",tempo:70,  octave:3, energy:0.3,  swing:0.1, voicing:"open",   arpStyle:"up",    drumPattern:"none",   instrument:"flute" },
    playful:    { scale:"mixolydian",tempo:132, octave:4, energy:0.75, swing:0.2, voicing:"open",   arpStyle:"updown",drumPattern:"pop",    instrument:"piano" },
    epic:       { scale:"harmonicMinor",tempo:96,octave:3,energy:0.85, swing:0,   voicing:"power",  arpStyle:"up",    drumPattern:"epic",   instrument:"strings" },
    nostalgia:  { scale:"pentatonic",tempo:86,  octave:4, energy:0.4,  swing:0.15,voicing:"spread", arpStyle:"down",  drumPattern:"ballad", instrument:"piano" },
  };

  // Drum patterns for composition
  const COMP_DRUMS = {
    pop:    { kick:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
    ballad: { kick:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0] },
    drive:  { kick:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare:[0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0], hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
    epic:   { kick:[1,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0], snare:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], tom:[0,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0] },
    sparse: { kick:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], rim:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], shaker:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] },
    none:   {},
  };

  let compositionTimer = null;
  let compositionPlaying = false;
  let compositionStartTime = 0;
  let compositionDuration = 0;
  let compositionNotes = []; // for piano roll

  /* ---------- Voice Leading Engine ----------
     Move each chord voice to the nearest available note
     in the next chord for smooth, musical transitions */
  function voiceLead(prevVoicing, nextChordRoot, nextQuality, octave) {
    const nextIntervals = CHORD_TYPES[nextQuality];
    const targetPitches = nextIntervals.map(n => nextChordRoot + n);
    // If no previous voicing, create initial spread voicing
    if (!prevVoicing || prevVoicing.length === 0) {
      const baseMidi = (octave + 1) * 12 + nextChordRoot;
      return targetPitches.map((p, i) => {
        let midi = baseMidi + (p - nextChordRoot);
        if (i > 0 && midi <= baseMidi) midi += 12;
        return midi;
      });
    }
    // For each voice, find the nearest target pitch class
    const voicing = [];
    const usedTargets = new Set();
    prevVoicing.forEach((prevMidi, vi) => {
      let bestMidi = prevMidi;
      let bestDist = 999;
      targetPitches.forEach((tp, ti) => {
        if (usedTargets.has(ti)) return;
        // Find nearest octave of this pitch class
        for (let oct = -1; oct <= 1; oct++) {
          const candidate = (Math.floor(prevMidi / 12)) * 12 + tp + oct * 12;
          const dist = Math.abs(candidate - prevMidi);
          if (dist < bestDist) {
            bestDist = dist;
            bestMidi = candidate;
          }
        }
      });
      voicing.push(bestMidi);
    });
    // If we have more target notes than voices, add them
    while (voicing.length < targetPitches.length) {
      const baseMidi = (octave + 1) * 12 + nextChordRoot;
      voicing.push(baseMidi + targetPitches[voicing.length]);
    }
    return voicing;
  }

  /* ---------- Motif Generator ----------
     Creates a short melodic idea (3-5 notes) with specific
     rhythm and contour, then develops it through the piece */
  function generateMotif(scaleArr, energy) {
    const motifLen = energy > 0.6 ? 5 : energy > 0.3 ? 4 : 3;
    const degrees = []; // scale degree indices
    const rhythms = []; // duration multipliers
    let deg = Math.floor(scaleArr.length / 2); // start mid-range

    // Contour: arch shape (rise then fall) — most natural
    for (let i = 0; i < motifLen; i++) {
      degrees.push(deg);
      const progress = i / (motifLen - 1);
      if (progress < 0.5) {
        // Rising phase
        deg += Math.random() > 0.3 ? 1 : 2;
      } else {
        // Falling phase
        deg -= Math.random() > 0.3 ? 1 : 2;
      }
      deg = Math.max(0, Math.min(scaleArr.length * 2 - 1, deg));

      // Rhythmic variety: mix of long and short
      if (i === 0) rhythms.push(1.5);       // Start with a longer note
      else if (i === motifLen - 1) rhythms.push(2.0); // End with longest
      else rhythms.push(Math.random() > 0.5 ? 0.75 : 1.0); // Mix
    }
    return { degrees, rhythms };
  }

  /* Develop a motif: transpose, invert, fragment, augment */
  function developMotif(motif, technique, transpose) {
    const { degrees, rhythms } = motif;
    const shift = transpose || 0;
    switch (technique) {
      case "transpose":
        return { degrees: degrees.map(d => d + shift), rhythms: [...rhythms] };
      case "invert": {
        const pivot = degrees[0];
        return { degrees: degrees.map(d => pivot - (d - pivot) + shift), rhythms: [...rhythms] };
      }
      case "fragment":
        // Use first half of motif
        const half = Math.ceil(degrees.length / 2);
        return { degrees: degrees.slice(0, half).map(d => d + shift), rhythms: rhythms.slice(0, half) };
      case "augment":
        return { degrees: degrees.map(d => d + shift), rhythms: rhythms.map(r => r * 1.5) };
      case "sequence":
        // Repeat motif shifted up by step
        return { degrees: degrees.map(d => d + shift + 2), rhythms: [...rhythms] };
      default:
        return { degrees: degrees.map(d => d + shift), rhythms: [...rhythms] };
    }
  }

  /* ---------- Rhythm Pattern Library ----------
     Real musical rhythms, not grid-quantized */
  const RHYTHM_PATTERNS = {
    // Each pattern = array of [beatOffset, durationMultiplier]
    steady4:   [[0, 1], [1, 1], [2, 1], [3, 1]],
    dotted:    [[0, 1.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5]],
    syncopated:[[0, 1], [1, 0.5], [1.5, 1], [2.5, 0.5], [3, 1]],
    sparse:    [[0, 2], [2.5, 1.5]],
    flowing:   [[0, 0.75], [0.75, 0.75], [1.5, 1], [2.5, 0.75], [3.25, 0.75]],
    triplet:   [[0, 0.67], [0.67, 0.67], [1.33, 0.67], [2, 0.67], [2.67, 0.67], [3.33, 0.67]],
    waltz:     [[0, 1.5], [1.5, 0.75], [2.25, 0.75], [3, 1]],
    driving:   [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]],
  };

  /* Pick rhythm pattern based on energy & section */
  function pickRhythmPattern(energy, sectionName) {
    if (sectionName === "intro" || sectionName === "outro") return RHYTHM_PATTERNS.sparse;
    if (sectionName === "bridge") return RHYTHM_PATTERNS.waltz;
    if (energy > 0.8) return Math.random() > 0.5 ? RHYTHM_PATTERNS.driving : RHYTHM_PATTERNS.syncopated;
    if (energy > 0.5) return Math.random() > 0.5 ? RHYTHM_PATTERNS.flowing : RHYTHM_PATTERNS.dotted;
    return Math.random() > 0.5 ? RHYTHM_PATTERNS.steady4 : RHYTHM_PATTERNS.sparse;
  }

  /* ---------- Bass Pattern Library ---------- */
  function generateBassLine(chordRoot, chordQuality, beatDur, barStart, energy, sectionName, scaleArr, keyRoot, vols, intensity) {
    const bassMidi = noteToMidi(NOTES[chordRoot], 2);
    const fifth = bassMidi + 7;
    const octave = bassMidi + 12;
    const notes = [];

    if (sectionName === "intro") {
      // Intro: just whole notes on root
      synthNote(midiToFreq(bassMidi), beatDur * 3.5, "bass", barStart, vols * intensity * 0.6);
      notes.push({ midi: bassMidi, time: barStart - compositionStartTime, dur: beatDur * 3.5, layer: "bass" });
      return notes;
    }

    if (sectionName === "outro") {
      // Outro: root held, fading
      synthNote(midiToFreq(bassMidi), beatDur * 3, "bass", barStart, vols * intensity * 0.4);
      notes.push({ midi: bassMidi, time: barStart - compositionStartTime, dur: beatDur * 3, layer: "bass" });
      return notes;
    }

    if (energy > 0.7) {
      // Walking bass: root - passing - fifth - chromatic approach to next root
      const scaleDeg = scaleArr || [0, 2, 4, 5, 7];
      const passingNote = bassMidi + (scaleDeg[2] || 4); // third
      const approach = bassMidi - 1; // chromatic approach from below (to next chord)
      const pattern = [
        [0, bassMidi, 0.9],
        [1, passingNote, 0.7],
        [2, fifth, 0.85],
        [3, approach, 0.6],
      ];
      pattern.forEach(([beat, midi, vol]) => {
        const t = barStart + beat * beatDur;
        synthNote(midiToFreq(midi), beatDur * 0.75, "bass", t, vols * intensity * vol);
        notes.push({ midi, time: t - compositionStartTime, dur: beatDur * 0.75, layer: "bass" });
      });
    } else if (energy > 0.4) {
      // Root-fifth pattern
      const pattern = [
        [0, bassMidi, 1.8, 0.9],
        [2, fifth, 1.5, 0.7],
      ];
      pattern.forEach(([beat, midi, dur, vol]) => {
        const t = barStart + beat * beatDur;
        synthNote(midiToFreq(midi), beatDur * dur, "bass", t, vols * intensity * vol);
        notes.push({ midi, time: t - compositionStartTime, dur: beatDur * dur, layer: "bass" });
      });
    } else {
      // Sustained root
      synthNote(midiToFreq(bassMidi), beatDur * 3.5, "bass", barStart, vols * intensity * 0.7);
      notes.push({ midi: bassMidi, time: barStart - compositionStartTime, dur: beatDur * 3.5, layer: "bass" });
    }
    return notes;
  }

  /* ---------- Style Profiles ----------
     Each style overrides instrument choices, voicing width,
     drum patterns, and arpeggio behavior */
  const STYLE_PROFILES = {
    classical:   { melInst:"piano",   chordInst:"strings", arpOn:false, drumPattern:"none",   reverb:true,  voicingWidth:2 },
    cinematic:   { melInst:"strings", chordInst:"pad",     arpOn:true,  drumPattern:"epic",   reverb:true,  voicingWidth:3 },
    jazz:        { melInst:"piano",   chordInst:"piano",   arpOn:false, drumPattern:"sparse", reverb:true,  voicingWidth:1 },
    ambient:     { melInst:"pad",     chordInst:"pad",     arpOn:true,  drumPattern:"none",   reverb:true,  voicingWidth:3 },
    pop:         { melInst:"synth",   chordInst:"piano",   arpOn:false, drumPattern:"pop",    reverb:false, voicingWidth:2 },
    electronic:  { melInst:"synth",   chordInst:"synth",   arpOn:true,  drumPattern:"drive",  reverb:false, voicingWidth:2 },
    folk:        { melInst:"flute",   chordInst:"piano",   arpOn:false, drumPattern:"sparse", reverb:true,  voicingWidth:1 },
    rnb:         { melInst:"piano",   chordInst:"pad",     arpOn:false, drumPattern:"pop",    reverb:true,  voicingWidth:2 },
  };

  /* ---------- Main Composition Generator ---------- */
  function generateComposition(mood, key, scaleChoice, tempo, bars, opts) {
    opts = opts || {};
    const profile = MOOD_PROFILES[mood] || MOOD_PROFILES.happy;
    const styleKey = (opts.style && opts.style !== "auto") ? opts.style : null;
    const styleDef = styleKey ? STYLE_PROFILES[styleKey] : null;

    // Merge complexity & energy from sliders (1-10 → 0-1)
    const userEnergy = opts.energy ? opts.energy / 10 : profile.energy;
    const userComplexity = opts.complexity ? opts.complexity / 10 : 0.5;

    const scale = scaleChoice === "auto" ? profile.scale : scaleChoice;
    const bpm = tempo || profile.tempo;
    const beatDur = 60 / bpm;
    const barDur = beatDur * 4;
    const totalBars = bars || 16;
    const totalTime = totalBars * barDur;
    const scaleArr = SCALES[scale] || SCALES.major;

    // Get chord progression
    const progs = PROGRESSIONS[mood] || PROGRESSIONS.happy;
    const prog = progs[Math.floor(Math.random() * progs.length)];
    const chords = getDiatonicChords(key, scale);

    // Get layer settings
    const layers = {
      chords: document.getElementById("layerChords")?.checked !== false,
      melody: document.getElementById("layerMelody")?.checked !== false,
      bass: document.getElementById("layerBass")?.checked !== false,
      arp: document.getElementById("layerArp")?.checked !== false,
      drums: document.getElementById("layerDrums")?.checked !== false,
    };
    const vols = {
      chords: (parseInt(document.getElementById("volChords")?.value || 60)) / 100 * 0.3,
      melody: (parseInt(document.getElementById("volMelody")?.value || 75)) / 100 * 0.35,
      bass: (parseInt(document.getElementById("volBass")?.value || 55)) / 100 * 0.35,
      arp: (parseInt(document.getElementById("volArp")?.value || 40)) / 100 * 0.2,
      drums: (parseInt(document.getElementById("volDrums")?.value || 50)) / 100 * 0.8,
    };

    // Build structure
    const structType = totalBars <= 8 ? "short" : totalBars <= 16 ? "short" : "medium";
    const structure = STRUCTURES[structType];
    const barsPerSection = Math.max(2, Math.floor(totalBars / structure.length));
    const sections = structure.map((name, i) => ({
      name,
      startBar: i * barsPerSection,
      bars: i === structure.length - 1 ? totalBars - i * barsPerSection : barsPerSection,
    }));

    const startTime = ctx.currentTime + 0.15;
    compositionNotes = [];
    compositionStartTime = startTime;
    compositionDuration = totalTime;

    // === PRE-GENERATE: Create a motif seed for the whole piece ===
    const mainMotif = generateMotif(scaleArr, userEnergy);

    // Resolve effective instruments from style or mood
    const effectiveMelInst = styleDef ? styleDef.melInst : profile.instrument;
    const effectiveChordInst = styleDef ? styleDef.chordInst : "pad";
    const effectiveDrumPattern = styleDef ? styleDef.drumPattern : profile.drumPattern;
    const effectiveArpEnabled = styleDef ? styleDef.arpOn : true;
    const useReverb = styleDef ? styleDef.reverb : true;
    // Define how motif develops across sections
    const motifPlan = {
      intro:  { technique: "fragment", transpose: 0 },
      verse:  { technique: "transpose", transpose: 0 },
      chorus: { technique: "transpose", transpose: 2 },  // Higher energy
      bridge: { technique: "invert", transpose: 1 },    // Contrast
      outro:  { technique: "augment", transpose: -2 },   // Slower, lower
    };

    let prevVoicing = null; // Track chord voicing for voice leading

    // Generate each section
    sections.forEach((section, sectionIdx) => {
      const sectionStart = startTime + section.startBar * barDur;
      const isIntro = section.name === "intro";
      const isOutro = section.name === "outro";
      const isChorus = section.name === "chorus";
      const isBridge = section.name === "bridge";

      // Dynamic intensity: ramp within each section
      const baseIntensity = isIntro ? 0.45 : isOutro ? 0.35 : isChorus ? 1.15 : isBridge ? 0.65 : 0.9;
      const melInstrument = isChorus ? effectiveMelInst : isBridge ? effectiveChordInst : isIntro ? "pad" : effectiveMelInst;

      // Get motif variation for this section
      const plan = motifPlan[section.name] || motifPlan.verse;
      const sectionMotif = developMotif(mainMotif, plan.technique, plan.transpose);

      for (let bar = 0; bar < section.bars; bar++) {
        const barStart = sectionStart + bar * barDur;
        const barInSection = bar / Math.max(1, section.bars - 1);
        const chordIdx = prog[bar % prog.length] - 1;
        const chord = chords[chordIdx % chords.length];
        const rootMidi = noteToMidi(NOTES[chord.root], profile.octave);

        // Dynamic shaping: crescendo in verses, peak in chorus
        let dynamicMult;
        if (isIntro) dynamicMult = 0.3 + barInSection * 0.4;        // Build up
        else if (isOutro) dynamicMult = 0.6 - barInSection * 0.4;    // Fade down
        else if (isChorus) dynamicMult = 0.95 + Math.sin(barInSection * Math.PI) * 0.2; // Peak in middle
        else dynamicMult = 0.7 + barInSection * 0.25;                // Gradual build
        const intensity = baseIntensity * dynamicMult;

        // === CHORDS with voice leading ===
        if (layers.chords) {
          prevVoicing = voiceLead(prevVoicing, chord.root, chord.quality, profile.octave);
          const chordDur = isIntro ? barDur * 0.9 : isBridge ? barDur * 0.5 : barDur * 0.85;
          const chordVol = vols.chords * intensity * (isIntro ? 0.5 : 1);

          // For bridge: play 2 chords per bar (faster harmonic rhythm)
          if (isBridge && bar % 2 === 0) {
            // First half
            prevVoicing.forEach(midi => {
              synthNote(midiToFreq(midi), barDur * 0.45, effectiveChordInst, barStart, chordVol * 0.85, useReverb);
              compositionNotes.push({ midi, time: barStart - startTime, dur: barDur * 0.45, layer: "chord" });
            });
            // Second half with next chord
            const nextChordIdx = prog[(bar + 1) % prog.length] - 1;
            const nextChord = chords[nextChordIdx % chords.length];
            prevVoicing = voiceLead(prevVoicing, nextChord.root, nextChord.quality, profile.octave);
            prevVoicing.forEach(midi => {
              const t = barStart + barDur * 0.5;
              synthNote(midiToFreq(midi), barDur * 0.45, effectiveChordInst, t, chordVol * 0.75, useReverb);
              compositionNotes.push({ midi, time: t - startTime, dur: barDur * 0.45, layer: "chord" });
            });
          } else {
            prevVoicing.forEach(midi => {
              synthNote(midiToFreq(midi), chordDur, effectiveChordInst, barStart, chordVol, useReverb);
              compositionNotes.push({ midi, time: barStart - startTime, dur: chordDur, layer: "chord" });
            });
          }
        }

        // === BASS with musical patterns ===
        if (layers.bass) {
          const bassNotes = generateBassLine(
            chord.root, chord.quality, beatDur, barStart,
            userEnergy * intensity, section.name, scaleArr,
            NOTES.indexOf(key), vols.bass, intensity
          );
          compositionNotes.push(...bassNotes);
        }

        // === MELODY with motif development ===
        if (layers.melody && !(isIntro && bar < 1)) {
          const melOctave = profile.octave + 1;
          const motifNotes = sectionMotif.degrees;
          const motifRhythms = sectionMotif.rhythms;
          const baseRhythm = pickRhythmPattern(userEnergy * intensity, section.name);

          // Complexity affects phrasing: high = more notes, low = sparser
          const shouldPlay = Math.random() < (userComplexity * 0.8 + 0.2);
          if (!shouldPlay && !isChorus) { /* skip bar for breathing room */ }
          else {
            // Use motif for phrase beginnings (bars 0 & 2), answer for bars 1 & 3
            const isMotifBar = (bar % 4 === 0 || bar % 4 === 2);

            if (isMotifBar) {
              // Play the motif (or a development of it)
              let t = 0;
              motifNotes.forEach((deg, i) => {
                if (i >= motifRhythms.length) return;
                const safeDeg = Math.max(0, Math.min(scaleArr.length * 2 - 1, deg));
                const octOffset = Math.floor(safeDeg / scaleArr.length);
                const degInScale = safeDeg % scaleArr.length;
                const melMidi = noteToMidi(key, melOctave + octOffset) + scaleArr[degInScale];
                const noteDur = beatDur * motifRhythms[i] * 0.85;
                const noteTime = barStart + t * beatDur;

                // Strong beat = louder, weak beat = softer (accent pattern)
                const accent = (t < 0.1 || (t > 1.9 && t < 2.1)) ? 1.0 : 0.75;
                const melVol = vols.melody * intensity * accent * (isOutro ? Math.max(0.1, 1 - barInSection) : 1);

                if (melVol > 0.01) {
                  synthNote(midiToFreq(melMidi), noteDur, melInstrument, noteTime, melVol, useReverb);
                  compositionNotes.push({ midi: melMidi, time: noteTime - startTime, dur: noteDur, layer: "melody" });
                }
                t += motifRhythms[i];
              });
            } else {
              // "Answer" phrase: respond to the motif with complementary movement
              const chordTones = CHORD_TYPES[chord.quality].map(n => chord.root + n);
              const rhythm = baseRhythm;
              let prevDeg = motifNotes[motifNotes.length - 1] || Math.floor(scaleArr.length / 2);

              rhythm.forEach(([beatOffset, durMult]) => {
                const isStrongBeat = beatOffset < 0.1 || (beatOffset > 1.9 && beatOffset < 2.1);
                let targetDeg;

                if (isStrongBeat) {
                  const chordDegrees = chordTones.map(ct => {
                    for (let d = 0; d < scaleArr.length; d++) {
                      if (scaleArr[d] % 12 === ct % 12) return d;
                    }
                    return Math.floor(scaleArr.length / 2);
                  });
                  targetDeg = chordDegrees[Math.floor(Math.random() * chordDegrees.length)];
                } else {
                  const step = Math.random() > 0.5 ? 1 : -1;
                  targetDeg = prevDeg + step;
                }

                targetDeg = Math.max(0, Math.min(scaleArr.length * 2 - 1, targetDeg));
                const octOffset = Math.floor(targetDeg / scaleArr.length);
                const degInScale = targetDeg % scaleArr.length;
                const melMidi = noteToMidi(key, melOctave + octOffset) + scaleArr[degInScale];
                const noteDur = beatDur * durMult * 0.8;
                const noteTime = barStart + beatOffset * beatDur;

                if (Math.random() > userEnergy + 0.3) return;

                const accent = isStrongBeat ? 1.0 : 0.7;
                const melVol = vols.melody * intensity * accent * 0.85;

                if (melVol > 0.01) {
                  synthNote(midiToFreq(melMidi), noteDur, melInstrument, noteTime, melVol, useReverb);
                  compositionNotes.push({ midi: melMidi, time: noteTime - startTime, dur: noteDur, layer: "melody" });
                }
                prevDeg = targetDeg;
              });

              // End of 4-bar phrase: resolve to tonic
              if (bar % 4 === 3) {
                const tonicMidi = noteToMidi(key, melOctave);
                const resolveTime = barStart + 3.5 * beatDur;
                synthNote(midiToFreq(tonicMidi), beatDur * 1.2, melInstrument, resolveTime, vols.melody * intensity * 0.6, useReverb);
                compositionNotes.push({ midi: tonicMidi, time: resolveTime - startTime, dur: beatDur * 1.2, layer: "melody" });
              }
            }
          }
        }

        // === ARPEGGIO with musical patterns ===
        if (layers.arp && effectiveArpEnabled && (isChorus || (isBridge && userEnergy > 0.5))) {
          const arpOctave = profile.octave + 1;
          const arpRoot = noteToMidi(NOTES[chord.root], arpOctave);
          const arpMidis = CHORD_TYPES[chord.quality].map(n => arpRoot + n);
          // Add octave note for fuller arpeggios
          arpMidis.push(arpMidis[0] + 12);

          const arpPatterns = {
            up:     [0,1,2,3,2,1,0,1],     // sweep up and back
            down:   [3,2,1,0,1,2,3,2],     // sweep down and back
            updown: [0,1,2,3,3,2,1,0],     // full arc
            random: Array.from({length:8}, (_, i) => {
              // Not truly random — alternate between low and high for musicality
              return i % 2 === 0 ? Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
            }),
          };
          const pattern = arpPatterns[profile.arpStyle] || arpPatterns.up;

          // Vary arp speed: 8th notes for chorus, dotted for bridge
          const arpDiv = isBridge ? beatDur * 0.75 : beatDur / 2;
          const arpVol = vols.arp * intensity;

          pattern.forEach((idx, i) => {
            if (i * arpDiv >= barDur) return;
            const t = barStart + i * arpDiv;
            const midi = arpMidis[idx % arpMidis.length];
            // Accent first note of each beat
            const accent = (i % 2 === 0) ? 1.0 : 0.65;
            synthNote(midiToFreq(midi), arpDiv * 0.65, "arp", t, arpVol * accent);
            compositionNotes.push({ midi, time: t - startTime, dur: arpDiv * 0.65, layer: "arp" });
          });
        }

        // === DRUMS with dynamic variation ===
        if (layers.drums && !isIntro) {
          const dp = COMP_DRUMS[effectiveDrumPattern] || {};
          Object.keys(dp).forEach(drum => {
            dp[drum].forEach((hit, step) => {
              if (!hit) return;
              if (isOutro && step > 8) return;
              // Ghost notes: occasional softer hits on off-beats for groove
              const isDownbeat = step % 4 === 0;
              const ghostVel = isDownbeat ? 1.0 : (step % 2 === 0 ? 0.8 : 0.6);
              const t = barStart + step * (beatDur / 4);
              synthDrum(drum, t, vols.drums * intensity * ghostVel);
            });
          });
          // Fill at end of 4-bar phrase in chorus
          if (isChorus && bar % 4 === 3) {
            const fillTimes = [12, 13, 14, 15].map(s => barStart + s * (beatDur / 4));
            fillTimes.forEach((t, i) => {
              synthDrum(i < 2 ? "tom" : "snare", t, vols.drums * intensity * 0.7);
            });
          }
        }
      }
    });

    return { startTime, duration: totalTime, sections, tempo: bpm };
  }

  /* ================================================================
     7. RAGA DATABASE (72 Melakartha + popular Janya ragas)
     ================================================================ */
  const SWARAS = { S:0, R1:1, R2:2, R3:3, G1:2, G2:3, G3:4, M1:5, M2:6, P:7, D1:8, D2:9, D3:10, N1:9, N2:10, N3:11 };

  const RAGAS = [
    // Melakartha Ragas (samplers)
    { name:"Shankarabharanam", aka:"Bilawal/Dheerashankarabharanam", mood:"joyful", time:"morning", aroha:["S","R2","G3","M1","P","D2","N3","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"72nd Melakarta. Foundation of Carnatic music, equivalent to Western major scale. Evokes brilliance and joy." },
    { name:"Kalyani", aka:"Yaman (Hindustani)", mood:"devotional", time:"evening", aroha:["S","R2","G3","M2","P","D2","N3","S"], avaroha:["S","N3","D2","P","M2","G3","R2","S"], desc:"65th Melakarta. Auspicious and serene. One of India's most beloved ragas, used for devotional and concert openings." },
    { name:"Kharaharapriya", aka:"Kafi (Hindustani)", mood:"romantic", time:"night", aroha:["S","R2","G2","M1","P","D2","N2","S"], avaroha:["S","N2","D2","P","M1","G2","R2","S"], desc:"22nd Melakarta. Versatile raga with deep emotional expression, widely used in film and classical music." },
    { name:"Harikambhoji", aka:"Khamaj", mood:"joyful", time:"evening", aroha:["S","R2","G3","M1","P","D2","N2","S"], avaroha:["S","N2","D2","P","M1","G3","R2","S"], desc:"28th Melakarta. Bright and cheerful, often used in light classical and film music." },
    { name:"Mayamalavagowla", aka:"Bhairav", mood:"devotional", time:"morning", aroha:["S","R1","G3","M1","P","D1","N3","S"], avaroha:["S","N3","D1","P","M1","G3","R1","S"], desc:"15th Melakarta. First raga taught to students. Sacred and foundational." },
    { name:"Todi (Shubhapantuvarali)", aka:"Todi", mood:"melancholy", time:"morning", aroha:["S","R1","G2","M2","P","D1","N3","S"], avaroha:["S","N3","D1","P","M2","G2","R1","S"], desc:"45th Melakarta. Deep and contemplative, expresses longing, pathos, and introspective beauty." },
    { name:"Bhairavi (Hanumathodi)", aka:"Bhairavi", mood:"devotional", time:"morning", aroha:["S","R1","G2","M1","P","D1","N2","S"], avaroha:["S","N2","D1","P","M1","G2","R1","S"], desc:"8th Melakarta. Queen of ragas. Emotional depth, devotion, and often used as the final raga in concerts." },
    { name:"Natabhairavi", aka:"Asavari", mood:"melancholy", time:"midday", aroha:["S","R2","G2","M1","P","D1","N2","S"], avaroha:["S","N2","D1","P","M1","G2","R2","S"], desc:"20th Melakarta. Equivalent to natural minor scale. Evokes sadness and contemplation." },
    { name:"Dheerashankarabharanam", aka:"Bilawal", mood:"joyful", time:"morning", aroha:["S","R2","G3","M1","P","D2","N3","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"29th Melakarta. Same as Western major. The most fundamental scale in world music." },
    { name:"Mechakalyani", aka:"Kalyani/Yaman", mood:"devotional", time:"evening", aroha:["S","R2","G3","M2","P","D2","N3","S"], avaroha:["S","N3","D2","P","M2","G3","R2","S"], desc:"65th Melakarta. Sublime and devotional, a pillar of both Carnatic and Hindustani traditions." },
    { name:"Hanumatodi", aka:"Bhairavi", mood:"devotional", time:"morning", aroha:["S","R1","G2","M1","P","D1","N2","S"], avaroha:["S","N2","D1","P","M1","G2","R1","S"], desc:"8th Melakarta. The complete Todi scale. Deep emotional weight for devotional and classical performance." },
    { name:"Simhendramadhyamam", aka:"Simhendramadhyamam", mood:"heroic", time:"midday", aroha:["S","R2","G2","M2","P","D1","N3","S"], avaroha:["S","N3","D1","P","M2","G2","R2","S"], desc:"57th Melakarta. Grand and powerful, evoking courage, determination, and majesty." },
    { name:"Hemavathi", aka:"Hemavathi", mood:"calm", time:"evening", aroha:["S","R2","G2","M2","P","D2","N2","S"], avaroha:["S","N2","D2","P","M2","G2","R2","S"], desc:"58th Melakarta. Meditative and calm, with a unique flavor from prati madhyamam." },
    { name:"Dharmavathi", aka:"Dharmavathi", mood:"calm", time:"night", aroha:["S","R2","G2","M2","P","D2","N3","S"], avaroha:["S","N3","D2","P","M2","G2","R2","S"], desc:"59th Melakarta. Haunting beauty. Peaceful yet emotionally deep." },
    { name:"Charukesi", aka:"Charukesi", mood:"romantic", time:"evening", aroha:["S","R2","G3","M1","P","D1","N2","S"], avaroha:["S","N2","D1","P","M1","G3","R2","S"], desc:"26th Melakarta. Western-influenced sound, widely used in film music for romantic themes." },
    { name:"Vakulabharanam", aka:"Vakulabharanam", mood:"devotional", time:"morning", aroha:["S","R1","G3","M1","P","D1","N2","S"], avaroha:["S","N2","D1","P","M1","G3","R1","S"], desc:"14th Melakarta. Devotional and unique, used extensively in krithis by Tyagaraja." },
    { name:"Chakravakam", aka:"Ahir Bhairav", mood:"devotional", time:"morning", aroha:["S","R1","G3","M1","P","D2","N3","S"], avaroha:["S","N3","D2","P","M1","G3","R1","S"], desc:"16th Melakarta. Morning devotional raga with a distinctive Middle Eastern flavor." },
    { name:"Vachaspathi", aka:"Vachaspathi", mood:"joyful", time:"evening", aroha:["S","R2","G3","M2","P","D2","N2","S"], avaroha:["S","N2","D2","P","M2","G3","R2","S"], desc:"64th Melakarta. Bright with prati madhyamam giving it a majestic, uplifting character." },
    { name:"Ramapriya", aka:"Ramapriya", mood:"romantic", time:"night", aroha:["S","R1","G3","M2","P","D2","N3","S"], avaroha:["S","N3","D2","P","M2","G3","R1","S"], desc:"52nd Melakarta. Romantic and haunting with its unique combination of shuddha rishabham and prati madhyamam." },
    { name:"Shanmukhapriya", aka:"Shanmukhapriya", mood:"heroic", time:"midday", aroha:["S","R2","G2","M2","P","D1","N2","S"], avaroha:["S","N2","D1","P","M2","G2","R2","S"], desc:"56th Melakarta. Popular in film music for dramatic, powerful themes." },
    // Popular Janya (derived) Ragas
    { name:"Mohanam", aka:"Bhoop/Bhopali", mood:"joyful", time:"evening", aroha:["S","R2","G3","P","D2","S"], avaroha:["S","D2","P","G3","R2","S"], desc:"Janya of Harikambhoji. Pentatonic raga full of sweetness and joy. Universally loved." },
    { name:"Hamsadhwani", aka:"Hamsadhwani", mood:"joyful", time:"evening", aroha:["S","R2","G3","P","N3","S"], avaroha:["S","N3","P","G3","R2","S"], desc:"Janya of Shankarabharanam. Auspicious pentatonic raga, traditionally used to begin concerts." },
    { name:"Hindolam", aka:"Malkauns", mood:"calm", time:"latenight", aroha:["S","G2","M1","D1","N2","S"], avaroha:["S","N2","D1","M1","G2","S"], desc:"Janya of Natabhairavi. Meditative and deep. Evokes stillness and the transcendence of late night." },
    { name:"Abhogi", aka:"Abhogi", mood:"romantic", time:"midday", aroha:["S","R2","G2","M1","D2","S"], avaroha:["S","D2","M1","G2","R2","S"], desc:"Janya of Kharaharapriya. Sweet and compact pentatonic raga with intimate romantic appeal." },
    { name:"Revathi", aka:"Revathi", mood:"melancholy", time:"night", aroha:["S","R1","M1","P","N2","S"], avaroha:["S","N2","P","M1","R1","S"], desc:"Sparse and poignant. Deep pathos and separation. A raga of longing and solitude." },
    { name:"Bilahari", aka:"Bilahari", mood:"heroic", time:"morning", aroha:["S","R2","G3","P","D2","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"Janya of Shankarabharanam. Valor and brightness. Asymmetric ascending gives it a distinctive brilliance." },
    { name:"Sahana", aka:"Sahana", mood:"romantic", time:"night", aroha:["S","R2","G3","M1","P","M1","D2","N3","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"Janya of Harikambhoji. Tender and amorous, expresses longing, romance and love." },
    { name:"Anandabhairavi", aka:"Anandabhairavi", mood:"joyful", time:"morning", aroha:["S","G2","R2","G2","M1","P","D2","P","S"], avaroha:["S","N2","D2","P","M1","G2","R2","S"], desc:"Janya of Natabhairavi. Blissful and auspicious, immensely popular in devotional and wedding music." },
    { name:"Amritavarshini", aka:"Malhar", mood:"calm", time:"evening", aroha:["S","G3","M2","P","N3","S"], avaroha:["S","N3","P","M2","G3","S"], desc:"The rainmaker raga. Said to invoke rainfall. Serene, mystical, and full of wonder." },
    { name:"Desh", aka:"Desh", mood:"romantic", time:"evening", aroha:["S","R2","M1","P","N3","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"Patriotic and romantic. Immensely popular in North Indian light classical and film music." },
    { name:"Yaman", aka:"Kalyani", mood:"calm", time:"evening", aroha:["S","R2","G3","M2","P","D2","N3","S"], avaroha:["S","N3","D2","P","M2","G3","R2","S"], desc:"First raga taught in Hindustani music. Peaceful, devotional, and universally beloved." },
    { name:"Bageshree", aka:"Bageshree", mood:"romantic", time:"night", aroha:["S","G2","M1","D1","N2","S"], avaroha:["S","N2","D1","M1","G2","R2","S"], desc:"Night raga par excellence. Deep romantic longing and emotional intimacy." },
    { name:"Durga", aka:"Durga", mood:"devotional", time:"night", aroha:["S","R2","M1","P","D2","S"], avaroha:["S","D2","P","M1","R2","S"], desc:"Named after goddess Durga. Simple, powerful, and profound in its devotional character." },
    { name:"Kambhoji", aka:"Kambhoji", mood:"heroic", time:"evening", aroha:["S","R2","G3","M1","P","D2","S"], avaroha:["S","N2","D2","P","M1","G3","R2","S"], desc:"One of the greatest ragas. Majestic, heroic, used extensively by all great composers." },
    { name:"Karaharapriya", aka:"Kafi", mood:"romantic", time:"night", aroha:["S","R2","G2","M1","P","D2","N2","S"], avaroha:["S","N2","D2","P","M1","G2","R2","S"], desc:"One of the most versatile ragas. Romantic, expressive, and perpetually popular in film music." },
    { name:"Thodi", aka:"Todi", mood:"melancholy", time:"morning", aroha:["S","R1","G2","M2","P","D1","N3","S"], avaroha:["S","N3","D1","P","M2","G2","R1","S"], desc:"Highly ornamented and emotionally intense. Quintessential morning raga for deep expression." },
    { name:"Keeravani", aka:"Yaman Kalyan", mood:"romantic", time:"night", aroha:["S","R2","G2","M1","P","D1","N3","S"], avaroha:["S","N3","D1","P","M1","G2","R2","S"], desc:"21st Melakarta. Hauntingly beautiful, made famous by the song 'Roja' composed by A.R. Rahman." },
    { name:"Madhyamavathi", aka:"Madhyamavathi", mood:"devotional", time:"latenight", aroha:["S","R2","M1","P","N2","S"], avaroha:["S","N2","P","M1","R2","S"], desc:"Pentatonic raga of deep devotion. Often the closing raga in concerts. Pure and transcendent." },
    { name:"Sri Raga", aka:"Sri", mood:"devotional", time:"evening", aroha:["S","R2","M1","P","N3","S"], avaroha:["S","N3","P","D2","N3","P","M1","R2","G3","R2","S"], desc:"Exalted and auspicious. Complex phrasing makes it a raga for advanced musicians." },
    { name:"Panthuvarali", aka:"Purvi", mood:"melancholy", time:"evening", aroha:["S","R1","G3","M2","P","D1","N3","S"], avaroha:["S","N3","D1","P","M2","G3","R1","S"], desc:"51st Melakarta. Intense and dramatic. Creates an atmosphere of grandeur and deep emotion." },
    { name:"Kaanada", aka:"Darbari Kanada", mood:"heroic", time:"night", aroha:["S","R2","G2","M1","P","D2","N2","S"], avaroha:["S","N2","D2","P","M1","G2","R2","S"], desc:"Majestic night raga. The 'royal' raga, associated with Mughal courts and grandeur." },
    { name:"Bhimpalasi", aka:"Bhimpalasi", mood:"romantic", time:"midday", aroha:["S","G2","M1","P","N2","S"], avaroha:["S","N2","D2","P","M1","G2","R2","S"], desc:"Afternoon raga of romantic longing. Sweet, simple, and deeply emotive." },
    { name:"Marwa", aka:"Marwa", mood:"calm", time:"evening", aroha:["S","R1","G3","M2","D2","N3","S"], avaroha:["S","N3","D2","M2","G3","R1","S"], desc:"Twilight raga without Pa. Creates an ethereal, suspended atmosphere of contemplation." },
    { name:"Poorvi", aka:"Poorvi", mood:"melancholy", time:"evening", aroha:["S","R1","G3","M2","P","D1","N3","S"], avaroha:["S","N3","D1","P","M2","G3","R1","S"], desc:"Sunset raga of deep gravity. Meditative and introspective with vivadi swaras." },
    { name:"Kedar", aka:"Kedar", mood:"devotional", time:"night", aroha:["S","M1","M1","P","D2","M1","P","G3","M1","R2","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"Devotional night raga dedicated to Lord Shiva. Vakra phrases create a meditative quality." },
    { name:"Tilak Kamod", aka:"Tilak Kamod", mood:"joyful", time:"night", aroha:["S","R2","G3","P","N3","S"], avaroha:["S","N3","D2","P","G3","M1","R2","S"], desc:"Elegant and joyful night raga. Sweet and uplifting, popular in semi-classical music." },
    { name:"Brindavana Saranga", aka:"Brindavana Saranga", mood:"romantic", time:"midday", aroha:["S","R2","M1","P","N3","S"], avaroha:["S","N3","P","M1","R2","S"], desc:"Pentatonic raga evocative of Lord Krishna in Brindavan. Sweet, romantic, and devotional." },
    { name:"Vasantha", aka:"Vasantha", mood:"romantic", time:"evening", aroha:["S","M1","G3","M1","D1","N3","S"], avaroha:["S","N3","D1","M1","G3","R1","S"], desc:"Raga of spring. Romantic and celebratory. Vakra phrases add ornamental beauty." },
    { name:"Surutti", aka:"Surutti", mood:"devotional", time:"morning", aroha:["S","R2","M1","P","D2","N2","S"], avaroha:["S","N2","D2","P","M1","R2","S"], desc:"Bright devotional raga. Popular in Tyagaraja kritis and wedding nadhaswaram music." },
    { name:"Nattai", aka:"Nattai", mood:"heroic", time:"morning", aroha:["S","R2","G3","M1","P","D2","N3","S"], avaroha:["S","N3","P","M1","G3","M1","R2","S"], desc:"Grand and heroic. The traditional opening raga for concerts, used in 'Nattai Kurinji' invocations." },
    { name:"Gaula", aka:"Gaula", mood:"devotional", time:"morning", aroha:["S","R1","G3","M1","P","D1","S"], avaroha:["S","N3","D1","P","M1","G3","R1","S"], desc:"Ancient and devotional. The raga of saint Tyagaraja's most famous kriti 'Nagumomu Ganaleni'." },
    { name:"Arabhi", aka:"Arabhi", mood:"joyful", time:"morning", aroha:["S","R2","M1","P","D2","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"Joyful janya of Shankarabharanam. Popular for morning and auspicious occasions." },
    { name:"Atana", aka:"Atana", mood:"heroic", time:"night", aroha:["S","R2","M1","P","D2","S"], avaroha:["S","N2","D2","P","M1","G3","R2","S"], desc:"Powerful and heroic. Intense phrases used for expressing valor and grandeur." },
    { name:"Saveri", aka:"Saveri", mood:"melancholy", time:"evening", aroha:["S","R1","M1","P","D1","S"], avaroha:["S","N3","D1","P","M1","G3","R1","S"], desc:"Raga of sorrow and devotion. Sparse scale creates a haunting, vulnerable character." },
    { name:"Kedaram", aka:"Kedar", mood:"devotional", time:"night", aroha:["S","R2","G3","M1","P","D2","N3","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"Night raga of spiritual contemplation and devotional serenity." },
    { name:"Behag", aka:"Behag", mood:"romantic", time:"night", aroha:["S","G3","M1","P","N3","S"], avaroha:["S","N3","D2","P","M1","G3","M1","R2","S"], desc:"Beloved night raga of romance. Sweet, flowing melodies that capture the essence of love." },
    { name:"Nilambari", aka:"Nilambari", mood:"calm", time:"latenight", aroha:["S","R2","G3","M1","P","D2","N3","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"The lullaby raga. Incredibly soothing and calming. Used to put children to sleep." },
    { name:"Shanmukhapriya Janya", aka:"Latangi", mood:"heroic", time:"midday", aroha:["S","R2","G3","M2","P","D1","N3","S"], avaroha:["S","N3","D1","P","M2","G3","R2","S"], desc:"63rd Melakarta. Energetic and dramatic with a unique flavor from its vivadi combination." },
    { name:"Hamsanandi", aka:"Sohni", mood:"romantic", time:"latenight", aroha:["S","R2","G3","M2","D2","N3","S"], avaroha:["S","N3","D2","M2","G3","R2","S"], desc:"Pa-less raga of late night. Ethereal and deeply romantic with a suspended quality." },
    { name:"Malkauns", aka:"Hindolam", mood:"calm", time:"latenight", aroha:["S","G2","M1","D1","N2","S"], avaroha:["S","N2","D1","M1","G2","S"], desc:"Midnight pentatonic raga. One of the most powerful ragas for meditation and late night performance." },
    { name:"Bhoopalam", aka:"Bhoop", mood:"joyful", time:"morning", aroha:["S","R2","G3","P","D2","S"], avaroha:["S","D2","P","G3","R2","S"], desc:"Morning raga of joy. Universally pleasing pentatonic scale found in music worldwide." },
    { name:"Madhuvanthi", aka:"Madhuvanthi", mood:"romantic", time:"evening", aroha:["S","R2","G3","M2","P","N3","S"], avaroha:["S","N3","P","M2","G3","R2","S"], desc:"Pa-ascending only raga of romantic beauty. Popularized immensely by film music." },
    { name:"Kapi", aka:"Kapi", mood:"romantic", time:"midday", aroha:["S","R2","G2","M1","P","D2","N3","S"], avaroha:["S","N2","D2","P","M1","G3","R2","S"], desc:"Mishra raga with dual gandharam and nishadam. One of the most popular ragas in film music." },
    { name:"Khamas", aka:"Khamas", mood:"joyful", time:"night", aroha:["S","G3","M1","P","D2","N2","S"], avaroha:["S","N2","D2","P","M1","G3","R2","S"], desc:"Night raga of joy and celebration. Popular for lighter, festive compositions." },
    { name:"Darbari Kanada", aka:"Darbari", mood:"heroic", time:"night", aroha:["S","R2","G2","M1","P","D1","N2","S"], avaroha:["S","N2","D1","N2","P","M1","P","G2","M1","R2","S"], desc:"Emperor of night ragas. Deep oscillations (andolan) on Ga and Dha create an unmatched majesty." },
    { name:"Puriya Dhanashri", aka:"Puriya Dhanashri", mood:"calm", time:"evening", aroha:["S","R1","G3","M2","P","D1","N3","S"], avaroha:["S","N3","D1","P","M2","G3","R1","S"], desc:"Evening raga of deep introspection. Combines the gravitas of Puriya with Dhanashri's sweetness." },
    { name:"Jaunpuri", aka:"Jaunpuri", mood:"calm", time:"midday", aroha:["S","R2","G2","M1","P","D2","N2","S"], avaroha:["S","N2","D2","P","M1","G2","R2","S"], desc:"Named after the city of Jaunpur. Calm, serene, and often used for contemplative ragas in the afternoon." },
    { name:"Lalitha", aka:"Lalitha", mood:"romantic", time:"evening", aroha:["S","R1","G3","M2","D1","N3","S"], avaroha:["S","N3","D1","M2","G3","R1","S"], desc:"Evening raga without Pa. Delicate and romantic, creating an atmosphere of elegant beauty." },
    { name:"Nalinakanthi", aka:"Nalinakanthi", mood:"romantic", time:"night", aroha:["S","G3","R2","G3","M1","P","D2","N3","S"], avaroha:["S","N3","D2","P","M1","G3","R2","S"], desc:"Enchanting night raga with vakra phrases. Sweet and romantic with ornamental beauty." },
    { name:"Mukhari", aka:"Mukhari", mood:"melancholy", time:"evening", aroha:["S","R2","G2","M1","P","D1","N2","S"], avaroha:["S","N2","D1","P","M1","G2","R2","S"], desc:"Ancient raga of deep sorrow. Gravitas and emotional weight make it ideal for classical expression." },
  ];

  function swaraToSemitone(sw) { return SWARAS[sw] ?? 0; }

  function ragaToFreqs(swaras, baseFreq) {
    let prevSemitone = -1;
    return swaras.map((sw, i) => {
      let st = swaraToSemitone(sw);
      if (i > 0 && st <= prevSemitone && i === swaras.length - 1) st += 12;
      if (i > 0 && st < prevSemitone && swaras[0] === "S") {
        // Check if descending
        const isDesc = swaraToSemitone(swaras[1]) > swaraToSemitone(swaras[Math.min(2, swaras.length-1)]);
        if (!isDesc && st <= prevSemitone) st += 12;
      }
      prevSemitone = st;
      return baseFreq * Math.pow(2, st / 12);
    });
  }

  /* ================================================================
     8. BEAT MAKER ENGINE
     ================================================================ */
  const DRUM_ROWS = ["kick","snare","hihat","openhat","clap","tom","rim","shaker"];
  const DRUM_LABELS = {
    kick:"Kick", snare:"Snare", hihat:"Hi-Hat", openhat:"Open Hat",
    clap:"Clap", tom:"Tom", rim:"Rim Shot", shaker:"Shaker"
  };
  const DRUM_COLORS = {
    kick:"var(--accent)", snare:"var(--pink)", hihat:"var(--cyan)", openhat:"var(--green)",
    clap:"var(--orange)", tom:"var(--red)", rim:"var(--blue)", shaker:"#f472b6"
  };

  const BEAT_PRESETS = {
    rock:      { kick:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
    hiphop:    { kick:[1,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], openhat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0] },
    jazz:      { kick:[1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,0], rim:[0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0] },
    latin:     { kick:[1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0], clap:[0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1], shaker:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], tom:[0,0,1,0,0,0,1,0,0,0,1,0,0,1,0,0] },
    edm:       { kick:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], clap:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], openhat:[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1] },
    dnb:       { kick:[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0], hihat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], rim:[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1] },
    funk:      { kick:[1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1], hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], openhat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1] },
    bollywood: { kick:[1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], tom:[0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1] },
    classical: { kick:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], tom:[0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0], shaker:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
  };

  const STEPS = 16;
  let beatGrid = {};
  let beatVolumes = {};
  let beatPlaying = false;
  let beatInterval = null;
  let beatStep = 0;

  /* ================================================================
     9. STATE
     ================================================================ */
  let currentTab = "mood";
  let selectedMood = null;
  let selectedRaga = null;
  let ragaPlaying = false;
  let ragaTimeouts = [];

  /* ================================================================
     10. UI CONTROLLERS
     ================================================================ */
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // --- NAV ---
  function initNav() {
    const toggle = document.getElementById("navToggle");
    const navLinks = document.getElementById("navLinks");
    if (toggle && navLinks) {
      toggle.addEventListener("click", () => navLinks.classList.toggle("open"));
      navLinks.querySelectorAll("a").forEach(a =>
        a.addEventListener("click", () => navLinks.classList.remove("open"))
      );
    }
  }

  // --- TABS ---
  function initTabs() {
    document.querySelectorAll(".nav-links a[data-tab]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        switchTab(link.dataset.tab);
      });
    });
    switchTab("mood");
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    const panel = document.getElementById("tab-" + tab);
    if (panel) panel.classList.add("active");
    document.querySelectorAll(".nav-links a[data-tab]").forEach(a =>
      a.classList.toggle("active", a.dataset.tab === tab)
    );
  }

  // --- HERO VISUALIZER ---
  function initHeroViz() {
    const container = document.getElementById("heroVisualizer");
    if (!container) return;
    for (let i = 0; i < 48; i++) {
      const bar = document.createElement("div");
      bar.className = "hero-bar";
      bar.style.height = "8px";
      container.appendChild(bar);
    }
    const bars = container.querySelectorAll(".hero-bar");
    (function animate() {
      bars.forEach((bar, i) => {
        const h = 6 + Math.sin(Date.now() / 400 + i * 0.4) * 20 + Math.sin(Date.now() / 700 + i * 0.2) * 10 + Math.random() * 5;
        bar.style.height = h + "px";
      });
      requestAnimationFrame(animate);
    })();
  }

  // --- COMPOSER UI ---
  function initMoodComposer() {
    const grid = document.getElementById("moodGrid");
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".mood-card");
      if (!card) return;
      // Allow deselecting mood
      if (card.classList.contains("selected")) {
        card.classList.remove("selected");
        selectedMood = null;
        return;
      }
      document.querySelectorAll(".mood-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedMood = card.dataset.mood;
      const profile = MOOD_PROFILES[selectedMood];
      if (profile) {
        document.getElementById("moodTempo").value = profile.tempo;
        document.getElementById("moodTempoVal").textContent = profile.tempo + " BPM";
        // Sync energy slider to mood's energy
        const energySlider = document.getElementById("compEnergy");
        if (energySlider) {
          const energyVal = Math.round(profile.energy * 10);
          energySlider.value = energyVal;
          document.getElementById("compEnergyVal").textContent = energyVal;
        }
      }
    });

    // New controls
    document.getElementById("compComplexity").addEventListener("input", (e) => {
      document.getElementById("compComplexityVal").textContent = e.target.value;
    });
    document.getElementById("compEnergy").addEventListener("input", (e) => {
      document.getElementById("compEnergyVal").textContent = e.target.value;
    });

    document.getElementById("moodTempo").addEventListener("input", (e) => {
      document.getElementById("moodTempoVal").textContent = e.target.value + " BPM";
    });

    document.getElementById("moodGenerate").addEventListener("click", () => {
      // Mood is now optional — use 'happy' as default if none selected
      const mood = selectedMood || "happy";
      initAudio();
      stopComposition();
      compositionPlaying = true;
      document.getElementById("moodStop").disabled = false;
      document.getElementById("moodGenerate").classList.remove("pulse-ready");
      document.getElementById("moodVizArea").style.display = "block";

      const key = document.getElementById("moodKey").value;
      const scale = document.getElementById("moodScale").value;
      const tempo = parseInt(document.getElementById("moodTempo").value);
      const bars = parseInt(document.getElementById("moodDuration").value);
      const style = document.getElementById("compStyle").value;
      const complexity = parseInt(document.getElementById("compComplexity").value);
      const energy = parseInt(document.getElementById("compEnergy").value);

      const result = generateComposition(mood, key, scale, tempo, bars, { style, complexity, energy });

      // Show structure
      const structEl = document.getElementById("moodStructure");
      structEl.innerHTML = result.sections.map(s =>
        `<div class="structure-block ${s.name}" data-start="${s.startBar}">${s.name}</div>`
      ).join("");

      // Transport — show richer detail
      const moodLabel = selectedMood ? selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1) : "—";
      const styleLabel = style !== "auto" ? style.charAt(0).toUpperCase() + style.slice(1) : "Auto";
      document.getElementById("moodDetail").textContent =
        `${styleLabel} · ${moodLabel} · ${key} · ${tempo} BPM · ${bars} bars`;
      document.getElementById("moodStatus").textContent = "Playing";

      // Start visualizers
      startPianoRollViz();
      startWaveformViz(document.getElementById("moodWaveform"));

      // Progress timer
      const startMs = Date.now();
      const totalMs = result.duration * 1000;
      compositionTimer = setInterval(() => {
        const elapsed = Date.now() - startMs;
        const pct = Math.min(100, (elapsed / totalMs) * 100);
        document.getElementById("moodProgress").style.width = pct + "%";
        const elSec = Math.floor(elapsed / 1000);
        const totSec = Math.floor(totalMs / 1000);
        document.getElementById("moodTime").textContent =
          `${Math.floor(elSec/60)}:${(elSec%60).toString().padStart(2,"0")} / ${Math.floor(totSec/60)}:${(totSec%60).toString().padStart(2,"0")}`;

        // Highlight active structure block
        const currentBar = Math.floor((elapsed / 1000) / (60 / tempo) / 4);
        document.querySelectorAll(".structure-block").forEach(b => {
          const bStart = parseInt(b.dataset.start);
          b.classList.toggle("active", currentBar >= bStart);
        });

        if (elapsed >= totalMs) {
          stopComposition();
          document.getElementById("moodStatus").textContent = "Complete";
        }
      }, 100);
    });

    document.getElementById("moodStop").addEventListener("click", stopComposition);
  }

  function stopComposition() {
    compositionPlaying = false;
    if (compositionTimer) { clearInterval(compositionTimer); compositionTimer = null; }
    document.getElementById("moodStop").disabled = true;
    document.getElementById("moodGenerate").classList.add("pulse-ready");
  }

  // --- PIANO ROLL VISUALIZER ---
  function startPianoRollViz() {
    const canvas = document.getElementById("moodPianoRoll");
    if (!canvas) return;
    const c = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const layerColors = {
      chord: "rgba(139,92,246,0.5)",
      melody: "rgba(236,72,153,0.8)",
      bass: "rgba(6,182,212,0.6)",
      arp: "rgba(245,158,11,0.5)",
    };

    function draw() {
      if (!compositionPlaying) return;
      requestAnimationFrame(draw);
      c.fillStyle = "#0f0f16";
      c.fillRect(0, 0, W, H);

      // Grid lines
      c.strokeStyle = "rgba(42,42,58,0.5)";
      c.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const y = (i / 12) * H;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }

      if (compositionNotes.length === 0) return;

      const elapsed = (ctx.currentTime - compositionStartTime);
      const windowStart = Math.max(0, elapsed - 2);
      const windowEnd = elapsed + compositionDuration * 0.3;

      // Find MIDI range
      let minMidi = 127, maxMidi = 0;
      compositionNotes.forEach(n => {
        if (n.midi < minMidi) minMidi = n.midi;
        if (n.midi > maxMidi) maxMidi = n.midi;
      });
      const midiRange = Math.max(24, maxMidi - minMidi + 4);

      compositionNotes.forEach(note => {
        if (note.time + note.dur < windowStart || note.time > windowEnd) return;
        const x = ((note.time - windowStart) / (windowEnd - windowStart)) * W;
        const w = (note.dur / (windowEnd - windowStart)) * W;
        const y = H - ((note.midi - minMidi + 2) / midiRange) * H;
        const h = Math.max(3, (1 / midiRange) * H * 0.8);

        c.fillStyle = layerColors[note.layer] || "rgba(255,255,255,0.3)";
        c.beginPath();
        c.roundRect(x, y, Math.max(2, w - 1), h, 2);
        c.fill();

        // Glow for currently playing
        if (note.time <= elapsed && note.time + note.dur >= elapsed) {
          c.shadowColor = layerColors[note.layer] || "#fff";
          c.shadowBlur = 8;
          c.fill();
          c.shadowBlur = 0;
        }
      });

      // Playhead
      const phX = (elapsed - windowStart) / (windowEnd - windowStart) * W;
      c.strokeStyle = "rgba(255,255,255,0.6)";
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(phX, 0); c.lineTo(phX, H); c.stroke();
    }
    draw();
  }

  // --- WAVEFORM VISUALIZER ---
  function startWaveformViz(canvas) {
    if (!canvas || !analyser) return;
    const c = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    (function draw() {
      requestAnimationFrame(draw);
      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(data);

      c.fillStyle = "#0f0f16";
      c.fillRect(0, 0, W, H);

      const barW = (W / bufLen) * 2.5;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const h = (data[i] / 255) * H * 0.9;
        const hue = 260 + (i / bufLen) * 80;
        const alpha = 0.3 + (data[i] / 255) * 0.6;
        c.fillStyle = `hsla(${hue},75%,55%,${alpha})`;
        c.fillRect(x, H - h, barW - 1, h);
        x += barW;
      }
    })();
  }

  // --- RAGA EXPLORER UI ---
  function initRagaExplorer() {
    renderRagaGrid(RAGAS);
    document.getElementById("ragaSearch").addEventListener("input", filterRagas);
    document.getElementById("ragaMoodFilter").addEventListener("change", filterRagas);
    document.getElementById("ragaTimeFilter").addEventListener("change", filterRagas);
    document.getElementById("ragaDetailClose").addEventListener("click", () => {
      document.getElementById("ragaDetail").style.display = "none";
      stopRaga();
    });
    document.getElementById("ragaPlayAroha").addEventListener("click", () => playRagaScale("aroha"));
    document.getElementById("ragaPlayAvaro").addEventListener("click", () => playRagaScale("avaroha"));
    document.getElementById("ragaPlayBoth").addEventListener("click", () => playRagaScale("both"));
    document.getElementById("ragaGeneratePhrase").addEventListener("click", generateRagaPhrase);
    document.getElementById("ragaGenerateAlap").addEventListener("click", generateAlap);
    document.getElementById("ragaStopPlay").addEventListener("click", stopRaga);

    // Tanpura
    document.getElementById("tanpuraToggle").addEventListener("click", () => {
      initAudio();
      const btn = document.getElementById("tanpuraToggle");
      const controls = document.getElementById("tanpuraControls");
      if (tanpuraActive) {
        stopTanpura();
        btn.classList.remove("active");
        controls.style.display = "none";
      } else {
        const pitch = document.getElementById("tanpuraPitch").value;
        const vol = parseInt(document.getElementById("tanpuraVol").value) / 100 * 0.25;
        startTanpura(pitch, vol);
        btn.classList.add("active");
        controls.style.display = "flex";
      }
    });
    document.getElementById("tanpuraPitch").addEventListener("change", () => {
      if (tanpuraActive) {
        const pitch = document.getElementById("tanpuraPitch").value;
        const vol = parseInt(document.getElementById("tanpuraVol").value) / 100 * 0.25;
        startTanpura(pitch, vol);
      }
    });
    document.getElementById("tanpuraVol").addEventListener("input", () => {
      if (tanpuraGain) {
        tanpuraGain.gain.value = parseInt(document.getElementById("tanpuraVol").value) / 100 * 0.25;
      }
    });
  }

  function filterRagas() {
    const search = document.getElementById("ragaSearch").value.toLowerCase();
    const mood = document.getElementById("ragaMoodFilter").value;
    const time = document.getElementById("ragaTimeFilter").value;
    const filtered = RAGAS.filter(r => {
      if (search && !r.name.toLowerCase().includes(search) && !(r.aka && r.aka.toLowerCase().includes(search)) && !r.desc.toLowerCase().includes(search)) return false;
      if (mood !== "all" && r.mood !== mood) return false;
      if (time !== "all" && r.time !== time) return false;
      return true;
    });
    renderRagaGrid(filtered);
  }

  function renderRagaGrid(ragas) {
    const grid = document.getElementById("ragaGrid");
    document.getElementById("ragaCount").textContent = `Showing ${ragas.length} of ${RAGAS.length} ragas`;
    if (!ragas.length) {
      grid.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;font-size:0.85rem">No ragas match your filters. Try adjusting your search.</p>';
      return;
    }
    grid.innerHTML = ragas.map(r => {
      const idx = RAGAS.indexOf(r);
      return `<div class="raga-card" data-index="${idx}">
        <div class="raga-card-name">${esc(r.name)}</div>
        ${r.aka ? `<div class="raga-card-aka">${esc(r.aka)}</div>` : ""}
        <div class="raga-card-mood">🎭 ${esc(r.mood)} · 🕐 ${esc(r.time)}</div>
        <div class="raga-card-notes">${esc(r.aroha.join(" · "))}</div>
      </div>`;
    }).join("");

    grid.querySelectorAll(".raga-card").forEach(card => {
      card.addEventListener("click", () => showRagaDetail(parseInt(card.dataset.index)));
    });
  }

  function showRagaDetail(index) {
    initAudio();
    selectedRaga = RAGAS[index];
    if (!selectedRaga) return;
    document.getElementById("ragaDetail").style.display = "block";
    document.getElementById("ragaName").textContent = selectedRaga.name;
    document.getElementById("ragaAka").textContent = selectedRaga.aka ? `Also known as: ${selectedRaga.aka}` : "";
    document.getElementById("ragaMeta").innerHTML = `
      <span>🎭 ${esc(selectedRaga.mood)}</span>
      <span>🕐 ${esc(selectedRaga.time)}</span>
      <span>📊 ${selectedRaga.aroha.length - 2} swaras (ascending)</span>
    `;
    document.getElementById("ragaDesc").textContent = selectedRaga.desc;

    // Render swara notes as interactive elements
    document.getElementById("ragaArohanam").innerHTML = selectedRaga.aroha.map(s =>
      `<span class="swara-note" data-swara="${s}">${s}</span>`
    ).join("");
    document.getElementById("ragaAvarohanam").innerHTML = selectedRaga.avaroha.map(s =>
      `<span class="swara-note" data-swara="${s}">${s}</span>`
    ).join("");

    document.getElementById("ragaDetail").scrollIntoView({ behavior:"smooth", block:"nearest" });
  }

  function playRagaScale(direction) {
    if (!selectedRaga || !ctx) return;
    stopRaga();
    ragaPlaying = true;
    const baseFreq = 261.63; // C4
    let swaras;
    if (direction === "both") {
      swaras = [...selectedRaga.aroha, ...selectedRaga.avaroha.slice(1)];
    } else {
      swaras = direction === "aroha" ? selectedRaga.aroha : selectedRaga.avaroha;
    }
    const freqs = ragaToFreqs(swaras, baseFreq);
    const dur = 0.6;
    const canvas = document.getElementById("ragaCanvas");
    startWaveformViz(canvas);

    // Highlight swaras
    const noteEls = document.querySelectorAll(`#raga${direction === "avaroha" ? "Avarohanam" : "Arohanam"} .swara-note`);

    freqs.forEach((f, i) => {
      const tid = setTimeout(() => {
        if (!ragaPlaying) return;
        synthNote(f, dur * 0.85, "flute", ctx.currentTime, 0.3, true);
        // Highlight
        document.querySelectorAll(".swara-note.playing").forEach(el => el.classList.remove("playing"));
        if (direction !== "both") {
          if (noteEls[i]) noteEls[i].classList.add("playing");
        }
      }, i * dur * 1000);
      ragaTimeouts.push(tid);
    });

    ragaTimeouts.push(setTimeout(() => {
      ragaPlaying = false;
      document.querySelectorAll(".swara-note.playing").forEach(el => el.classList.remove("playing"));
    }, freqs.length * dur * 1000 + 300));
  }

  function generateRagaPhrase() {
    if (!selectedRaga || !ctx) return;
    stopRaga();
    ragaPlaying = true;
    const baseFreq = 261.63;
    const allSwaras = [...selectedRaga.aroha.slice(0, -1), ...selectedRaga.avaroha.slice(0, -1)];
    const phraseLen = 16 + Math.floor(Math.random() * 12);
    const phrase = [];
    let prev = Math.floor(allSwaras.length / 3);

    for (let i = 0; i < phraseLen; i++) {
      let step = Math.random() > 0.6 ? (Math.random() > 0.5 ? 2 : -2) : (Math.random() > 0.5 ? 1 : -1);
      if (Math.random() > 0.85) step = 0; // pause on same note (sustain effect)
      prev = Math.max(0, Math.min(allSwaras.length - 1, prev + step));
      phrase.push(allSwaras[prev]);
    }
    // End on Sa
    phrase.push("S");

    const freqs = ragaToFreqs(phrase, baseFreq);
    const durs = phrase.map(() => 0.25 + Math.random() * 0.25);
    const canvas = document.getElementById("ragaCanvas");
    startWaveformViz(canvas);

    let t = 0;
    freqs.forEach((f, i) => {
      const tid = setTimeout(() => {
        if (!ragaPlaying) return;
        synthNote(f, durs[i] * 0.85, "sitar", ctx.currentTime, 0.28, true);
      }, t * 1000);
      ragaTimeouts.push(tid);
      t += durs[i];
    });
    ragaTimeouts.push(setTimeout(() => { ragaPlaying = false; }, t * 1000 + 500));
  }

  function generateAlap() {
    if (!selectedRaga || !ctx) return;
    stopRaga();
    ragaPlaying = true;
    const baseFreq = 261.63;

    // Alapana: slow, deliberate exploration of raga
    const aroha = selectedRaga.aroha.slice(0, -1);
    const notes = [];
    // Start with Sa, gradually introduce each note
    let maxReach = 1;
    for (let phrase = 0; phrase < 6; phrase++) {
      maxReach = Math.min(aroha.length, maxReach + 1);
      const phraseNotes = [];
      // Build up
      for (let i = 0; i <= maxReach && i < aroha.length; i++) {
        phraseNotes.push(aroha[i]);
      }
      // Come back down
      for (let i = maxReach - 1; i >= 0; i--) {
        if (i < aroha.length) phraseNotes.push(aroha[i]);
      }
      // Add some repetition and ornamentation
      phraseNotes.forEach(n => {
        notes.push(n);
        if (Math.random() > 0.6) notes.push(n); // repeat
      });
      notes.push("S"); // return to Sa
    }

    const freqs = ragaToFreqs(notes, baseFreq);
    const canvas = document.getElementById("ragaCanvas");
    startWaveformViz(canvas);

    let t = 0;
    freqs.forEach((f, i) => {
      const dur = 0.4 + Math.random() * 0.4;
      const tid = setTimeout(() => {
        if (!ragaPlaying) return;
        synthNote(f, dur * 0.85, "flute", ctx.currentTime, 0.25, true);
      }, t * 1000);
      ragaTimeouts.push(tid);
      t += dur;
    });
    ragaTimeouts.push(setTimeout(() => { ragaPlaying = false; }, t * 1000 + 500));
  }

  function stopRaga() {
    ragaPlaying = false;
    ragaTimeouts.forEach(t => clearTimeout(t));
    ragaTimeouts = [];
    document.querySelectorAll(".swara-note.playing").forEach(el => el.classList.remove("playing"));
  }

  // --- BEAT MAKER UI ---
  function initBeatMaker() {
    buildSequencer();
    document.getElementById("beatTempo").addEventListener("input", (e) => {
      document.getElementById("beatTempoVal").textContent = e.target.value + " BPM";
    });
    document.getElementById("beatSwing").addEventListener("input", (e) => {
      document.getElementById("beatSwingVal").textContent = e.target.value + "%";
    });
    document.getElementById("beatMasterVol").addEventListener("input", (e) => {
      document.getElementById("beatMasterVolVal").textContent = e.target.value + "%";
    });
    document.getElementById("beatPattern").addEventListener("change", (e) => {
      if (e.target.value !== "custom") loadBeatPreset(e.target.value);
    });
    document.getElementById("beatPlay").addEventListener("click", startBeat);
    document.getElementById("beatStop").addEventListener("click", stopBeat);
    document.getElementById("beatClear").addEventListener("click", clearBeat);
    document.getElementById("beatRandomize").addEventListener("click", randomizeBeat);
  }

  function buildSequencer() {
    const header = document.getElementById("seqStepsHeader");
    const rows = document.getElementById("seqRows");
    header.innerHTML = "";
    rows.innerHTML = "";

    for (let s = 0; s < STEPS; s++) {
      const num = document.createElement("div");
      num.className = "seq-step-num" + (s % 4 === 0 ? " beat" : "");
      num.textContent = s + 1;
      header.appendChild(num);
    }

    DRUM_ROWS.forEach(drum => {
      beatGrid[drum] = new Array(STEPS).fill(0);
      beatVolumes[drum] = 80;
      const row = document.createElement("div");
      row.className = "seq-row";

      const label = document.createElement("div");
      label.className = "seq-row-label";
      label.innerHTML = `<span class="drum-dot" style="background:${DRUM_COLORS[drum]}"></span>${DRUM_LABELS[drum]}`;

      const volWrap = document.createElement("div");
      volWrap.className = "seq-row-vol";
      const volInput = document.createElement("input");
      volInput.type = "range";
      volInput.min = "0"; volInput.max = "100"; volInput.value = "80";
      volInput.addEventListener("input", () => { beatVolumes[drum] = parseInt(volInput.value); });
      volWrap.appendChild(volInput);

      const stepsWrap = document.createElement("div");
      stepsWrap.className = "seq-row-steps";
      for (let s = 0; s < STEPS; s++) {
        const cell = document.createElement("div");
        cell.className = "seq-cell" + (s % 4 === 0 ? " bar-start" : "");
        cell.dataset.step = s;
        cell.dataset.drum = drum;
        cell.addEventListener("click", () => {
          beatGrid[drum][s] = beatGrid[drum][s] ? 0 : 1;
          cell.classList.toggle("active");
          cell.classList.toggle(drum, beatGrid[drum][s]);
        });
        stepsWrap.appendChild(cell);
      }

      row.appendChild(label);
      row.appendChild(volWrap);
      row.appendChild(stepsWrap);
      rows.appendChild(row);
    });
  }

  function loadBeatPreset(name) {
    const preset = BEAT_PRESETS[name];
    if (!preset) return;
    clearBeat();
    DRUM_ROWS.forEach(drum => {
      if (preset[drum]) {
        beatGrid[drum] = [...preset[drum]];
        document.querySelectorAll(`.seq-cell[data-drum="${drum}"]`).forEach((cell, i) => {
          if (preset[drum][i]) { cell.classList.add("active", drum); }
        });
      }
    });
  }

  function clearBeat() {
    DRUM_ROWS.forEach(drum => { beatGrid[drum] = new Array(STEPS).fill(0); });
    document.querySelectorAll(".seq-cell").forEach(c => { c.className = c.className.replace(/active|kick|snare|hihat|openhat|clap|tom|rim|shaker/g, "").trim(); });
  }

  function randomizeBeat() {
    clearBeat();
    DRUM_ROWS.forEach(drum => {
      const density = drum === "kick" ? 0.28 : drum === "snare" ? 0.18 : drum === "hihat" ? 0.5 : 0.1;
      for (let s = 0; s < STEPS; s++) {
        if (Math.random() < density) {
          beatGrid[drum][s] = 1;
          const cell = document.querySelector(`.seq-cell[data-drum="${drum}"][data-step="${s}"]`);
          if (cell) cell.classList.add("active", drum);
        }
      }
    });
  }

  function startBeat() {
    initAudio();
    if (beatPlaying) stopBeat();
    beatPlaying = true;
    beatStep = 0;
    document.getElementById("beatPlay").disabled = true;
    document.getElementById("beatStop").disabled = false;
    startWaveformViz(document.getElementById("beatWaveform"));

    function tick() {
      if (!beatPlaying) return;
      const tempo = parseInt(document.getElementById("beatTempo").value);
      const swing = parseInt(document.getElementById("beatSwing").value) / 100;
      const masterVol = parseInt(document.getElementById("beatMasterVol").value) / 100;
      const stepDur = (60 / tempo) / 4;
      const swingOff = (beatStep % 2 === 1) ? stepDur * swing * 0.33 : 0;

      document.querySelectorAll(".seq-cell.playing").forEach(c => c.classList.remove("playing"));
      document.querySelectorAll(`.seq-cell[data-step="${beatStep}"]`).forEach(c => c.classList.add("playing"));

      DRUM_ROWS.forEach(drum => {
        if (beatGrid[drum][beatStep]) {
          const vol = (beatVolumes[drum] / 100) * masterVol;
          synthDrum(drum, ctx.currentTime + swingOff, vol);
        }
      });

      beatStep = (beatStep + 1) % STEPS;
      beatInterval = setTimeout(tick, stepDur * 1000);
    }
    tick();
  }

  function stopBeat() {
    beatPlaying = false;
    if (beatInterval) { clearTimeout(beatInterval); beatInterval = null; }
    document.querySelectorAll(".seq-cell.playing").forEach(c => c.classList.remove("playing"));
    document.getElementById("beatPlay").disabled = false;
    document.getElementById("beatStop").disabled = true;
  }

  // --- FREE PLAY UI ---
  const WHITE = ["C","D","E","F","G","A","B"];
  const BLACK_MAP = { 0:"C#", 1:"D#", 3:"F#", 4:"G#", 5:"A#" };
  const KB_MAP = { a:0, s:1, d:2, f:3, g:4, h:5, j:6, k:7 }; // white
  const KB_BLACK = { w:"C#", e:"D#", t:"F#", y:"G#", u:"A#" };

  function initFreePlay() {
    buildKeyboard();
    ["fpVolume","fpReverb","fpDelay"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", () => {
        document.getElementById(id + "Val").textContent = el.value + "%";
        if (id === "fpVolume" && masterGain) masterGain.gain.value = el.value / 100;
        if (id === "fpDelay" && delayWet) delayWet.gain.value = el.value / 100 * 0.4;
      });
    });
    document.getElementById("fpOctave").addEventListener("change", (e) => {
      document.getElementById("octaveIndicator").textContent = "Octave: " + e.target.value;
    });

    const active = new Set();
    document.addEventListener("keydown", (e) => {
      if (currentTab !== "freeplay" || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        const sel = document.getElementById("fpOctave");
        sel.value = Math.max(2, parseInt(sel.value) - 1);
        sel.dispatchEvent(new Event("change"));
        return;
      }
      if (k === "x") {
        const sel = document.getElementById("fpOctave");
        sel.value = Math.min(6, parseInt(sel.value) + 1);
        sel.dispatchEvent(new Event("change"));
        return;
      }
      if (active.has(k)) return;
      active.add(k);
      triggerKey(k, true);
    });
    document.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      active.delete(k);
      triggerKey(k, false);
    });

    startWaveformViz(document.getElementById("fpCanvas"));
  }

  function buildKeyboard() {
    const kb = document.getElementById("keyboard");
    if (!kb) return;
    kb.innerHTML = "";
    WHITE.forEach((note, i) => {
      const key = document.createElement("div");
      key.className = "key key-white";
      key.dataset.note = note;
      key.textContent = note;
      key.addEventListener("mousedown", () => { initAudio(); playFreeNote(note); key.classList.add("pressed"); });
      key.addEventListener("mouseup", () => key.classList.remove("pressed"));
      key.addEventListener("mouseleave", () => key.classList.remove("pressed"));
      kb.appendChild(key);

      if (BLACK_MAP[i] !== undefined) {
        const bk = document.createElement("div");
        bk.className = "key key-black";
        bk.dataset.note = BLACK_MAP[i];
        bk.textContent = BLACK_MAP[i].replace("#","♯");
        bk.addEventListener("mousedown", () => { initAudio(); playFreeNote(BLACK_MAP[i]); bk.classList.add("pressed"); });
        bk.addEventListener("mouseup", () => bk.classList.remove("pressed"));
        bk.addEventListener("mouseleave", () => bk.classList.remove("pressed"));
        kb.appendChild(bk);
      }
    });
  }

  function triggerKey(k, down) {
    let note;
    if (KB_MAP[k] !== undefined) note = WHITE[KB_MAP[k]];
    else if (KB_BLACK[k]) note = KB_BLACK[k];
    else return;

    const el = document.querySelector(`.key[data-note="${note}"]`);
    if (down) {
      initAudio();
      playFreeNote(note);
      if (el) el.classList.add("pressed");
    } else {
      if (el) el.classList.remove("pressed");
    }
  }

  function playFreeNote(note) {
    const octave = parseInt(document.getElementById("fpOctave").value);
    const instrument = document.getElementById("fpInstrument").value;
    const vol = parseInt(document.getElementById("fpVolume").value) / 100 * 0.35;
    const freq = midiToFreq(noteToMidi(note, octave));
    synthNote(freq, 1.2, instrument, ctx.currentTime, vol, true);

    // Feed delay
    const delayAmt = parseInt(document.getElementById("fpDelay")?.value || 0) / 100;
    if (delayAmt > 0 && delayNode) {
      const src = ctx.createOscillator();
      const g = ctx.createGain();
      src.type = "triangle";
      src.frequency.value = freq;
      g.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      src.connect(g);
      g.connect(delayNode);
      src.start(ctx.currentTime);
      src.stop(ctx.currentTime + 0.3);
    }
  }

  /* ================================================================
     AMBIENT BACKGROUND (Sonora-inspired)
     Subtle floating music symbols + soft glowing orbs
     ================================================================ */
  function initAmbientCanvas() {
    const canvas = document.getElementById("ambientCanvas");
    if (!canvas) return;
    const c = canvas.getContext("2d");
    let W, H, particles = [];

    const SYMBOLS = ["\u266A","\u266B","\u266C","\u2669","\u{1D11E}","\u{1D122}"];
    const ORB_COLORS = ["139,92,246","236,72,153","6,182,212","245,158,11"];

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function seed() {
      particles = [];
      const count = Math.min(28, Math.floor((W * H) / 40000));
      for (let i = 0; i < count; i++) {
        const type = Math.random();
        if (type < 0.5) {
          // Music note
          particles.push({
            type: "note",
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.15,
            vy: -(Math.random() * 0.2 + 0.06),
            char: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            size: 10 + Math.random() * 14,
            alpha: 0.03 + Math.random() * 0.07,
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 0.004,
          });
        } else {
          // Soft orb
          const col = ORB_COLORS[Math.floor(Math.random() * ORB_COLORS.length)];
          particles.push({
            type: "orb",
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.12,
            vy: (Math.random() - 0.5) * 0.12,
            r: 40 + Math.random() * 80,
            color: col,
            alpha: 0.02 + Math.random() * 0.04,
            ph: Math.random() * Math.PI * 2,
            phV: 0.003 + Math.random() * 0.005,
          });
        }
      }
    }
    seed();

    function draw() {
      requestAnimationFrame(draw);
      c.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        // Wrap
        if (p.type === "note") {
          if (p.y < -30) { p.y = H + 20; p.x = Math.random() * W; }
          if (p.x < -30) p.x = W + 20;
          if (p.x > W + 30) p.x = -20;
          p.rot += p.rotV;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.font = `${p.size}px serif`;
          c.fillStyle = `rgba(167,139,250,${p.alpha})`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(p.char, 0, 0);
          c.restore();
        } else {
          if (p.x < -p.r) p.x = W + p.r;
          if (p.x > W + p.r) p.x = -p.r;
          if (p.y < -p.r) p.y = H + p.r;
          if (p.y > H + p.r) p.y = -p.r;
          p.ph += p.phV;
          const a = p.alpha * (0.6 + 0.4 * Math.sin(p.ph));
          const grad = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grad.addColorStop(0, `rgba(${p.color},${a})`);
          grad.addColorStop(1, `rgba(${p.color},0)`);
          c.fillStyle = grad;
          c.beginPath();
          c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          c.fill();
        }
      });
    }
    draw();
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    initAmbientCanvas();
    initNav();
    initTabs();
    initHeroViz();
    initMoodComposer();
    initRagaExplorer();
    initBeatMaker();
    initFreePlay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
