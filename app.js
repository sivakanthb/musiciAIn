/* ============================================================
   MusiciAIn — AI Music Composer Engine
   Web Audio API — fully browser-based
   ============================================================ */
(function () {
  "use strict";

  // ======================== AUDIO CONTEXT ========================
  let ctx = null;
  let masterGain = null;
  let reverbNode = null;
  let analyser = null;

  function initAudio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
    createReverb();
  }

  function createReverb() {
    reverbNode = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const length = rate * 2;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    reverbNode.buffer = impulse;
  }

  // ======================== NOTE FREQUENCIES ========================
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function noteFreq(note, octave) {
    const idx = NOTE_NAMES.indexOf(note);
    if (idx === -1) return 440;
    const midi = (octave + 1) * 12 + idx;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ======================== SCALES ========================
  const SCALES = {
    major:       [0, 2, 4, 5, 7, 9, 11],
    minor:       [0, 2, 3, 5, 7, 8, 10],
    pentatonic:  [0, 2, 4, 7, 9],
    blues:       [0, 3, 5, 6, 7, 10],
    dorian:      [0, 2, 3, 5, 7, 9, 10],
    mixolydian:  [0, 2, 4, 5, 7, 9, 10],
  };

  function getScaleFreqs(key, scale, octave, numOctaves) {
    const intervals = SCALES[scale] || SCALES.major;
    const root = NOTE_NAMES.indexOf(key);
    const freqs = [];
    for (let o = 0; o < numOctaves; o++) {
      for (const interval of intervals) {
        const midi = (octave + o + 1) * 12 + root + interval;
        freqs.push(440 * Math.pow(2, (midi - 69) / 12));
      }
    }
    return freqs;
  }

  // ======================== SYNTH VOICES ========================
  function playNote(freq, duration, type, startTime, vol) {
    if (!ctx) return;
    const t = startTime || ctx.currentTime;
    const v = vol || 0.3;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(v, t + 0.02);
    gain.gain.setValueAtTime(v, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  function playInstrumentNote(freq, duration, instrument, startTime, vol) {
    if (!ctx) return;
    const t = startTime || ctx.currentTime;
    const v = vol || 0.3;
    const instruments = {
      piano:   { type: "triangle", attack: 0.01,  decay: 0.3,  sustain: 0.4  },
      synth:   { type: "sawtooth", attack: 0.05,  decay: 0.2,  sustain: 0.6  },
      strings: { type: "sine",     attack: 0.15,  decay: 0.4,  sustain: 0.7  },
      flute:   { type: "sine",     attack: 0.08,  decay: 0.1,  sustain: 0.5  },
      sitar:   { type: "sawtooth", attack: 0.005, decay: 0.15, sustain: 0.2  },
    };
    const inst = instruments[instrument] || instruments.piano;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = inst.type;
    osc.frequency.setValueAtTime(freq, t);

    // Sitar vibrato
    if (instrument === "sitar") {
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.frequency.value = 5;
      vibratoGain.gain.value = 3;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(t);
      vibrato.stop(t + duration);
    }

    // ADSR envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(v, t + inst.attack);
    gain.gain.exponentialRampToValueAtTime(v * inst.sustain, t + inst.attack + inst.decay);
    gain.gain.setValueAtTime(v * inst.sustain, t + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);

    // Optional reverb
    const reverbAmt = parseFloat(document.getElementById("fpReverb")?.value || 30) / 100;
    if (reverbAmt > 0 && reverbNode) {
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      dryGain.gain.value = 1 - reverbAmt * 0.5;
      wetGain.gain.value = reverbAmt * 0.5;
      gain.connect(dryGain);
      gain.connect(reverbNode);
      reverbNode.connect(wetGain);
      dryGain.connect(masterGain);
      wetGain.connect(masterGain);
    } else {
      gain.connect(masterGain);
    }
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // ======================== DRUM SYNTH ========================
  function playDrum(type, time) {
    if (!ctx) return;
    const t = time || ctx.currentTime;
    switch (type) {
      case "kick": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.35);
        break;
      }
      case "snare": {
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noise.buffer = buf;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 1000;
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.15);
        break;
      }
      case "hihat": {
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noise.buffer = buf;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 6000;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.05);
        break;
      }
      case "openhat": {
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noise.buffer = buf;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 4000;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.2);
        break;
      }
      case "clap": {
        for (let i = 0; i < 3; i++) {
          const noise = ctx.createBufferSource();
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
          noise.buffer = buf;
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.value = 2000;
          gain.gain.setValueAtTime(0.5, t + i * 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.01 + 0.08);
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(masterGain);
          noise.start(t + i * 0.01);
          noise.stop(t + i * 0.01 + 0.08);
        }
        break;
      }
      case "tom": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.25);
        break;
      }
      case "rim": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.03);
        break;
      }
      case "shaker": {
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
        noise.buffer = buf;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 8000;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.06);
        break;
      }
    }
  }

  // ======================== MOOD → MUSIC AI ========================
  const MOOD_PROFILES = {
    happy:      { scale: "major",      tempo: 130, octave: 4, patterns: "ascending",  energy: 0.8  },
    sad:        { scale: "minor",      tempo: 80,  octave: 3, patterns: "descending", energy: 0.3  },
    romantic:   { scale: "major",      tempo: 90,  octave: 4, patterns: "smooth",     energy: 0.5  },
    energetic:  { scale: "pentatonic", tempo: 150, octave: 4, patterns: "jumping",    energy: 1.0  },
    calm:       { scale: "pentatonic", tempo: 70,  octave: 4, patterns: "stepwise",   energy: 0.2  },
    melancholy: { scale: "minor",      tempo: 75,  octave: 3, patterns: "descending", energy: 0.25 },
    triumphant: { scale: "major",      tempo: 140, octave: 4, patterns: "ascending",  energy: 0.9  },
    mysterious: { scale: "dorian",     tempo: 85,  octave: 3, patterns: "chromatic",  energy: 0.4  },
    devotional: { scale: "pentatonic", tempo: 72,  octave: 3, patterns: "stepwise",   energy: 0.3  },
    playful:    { scale: "mixolydian", tempo: 135, octave: 4, patterns: "jumping",    energy: 0.75 },
    epic:       { scale: "minor",      tempo: 100, octave: 3, patterns: "wide",       energy: 0.85 },
    nostalgia:  { scale: "pentatonic", tempo: 88,  octave: 4, patterns: "smooth",     energy: 0.4  },
  };

  function generateMelody(mood, key, scale, tempo, bars) {
    const profile = MOOD_PROFILES[mood] || MOOD_PROFILES.happy;
    const useScale = scale || profile.scale;
    const useTempo = tempo || profile.tempo;
    const intervals = SCALES[useScale] || SCALES.major;
    const rootIdx = NOTE_NAMES.indexOf(key || "C");
    const octave = profile.octave;
    const beatDur = 60 / useTempo;
    const totalBeats = (bars || 16) * 4;

    const notes = [];
    let prevIdx = Math.floor(intervals.length / 2);
    let t = 0;

    for (let beat = 0; beat < totalBeats; beat++) {
      // Rest probability based on energy
      if (Math.random() > profile.energy + 0.3) {
        t += beatDur;
        continue;
      }

      // Duration variety
      const durChoices = [beatDur * 0.5, beatDur, beatDur * 1.5, beatDur * 2];
      const durWeights = profile.energy > 0.6 ? [0.4, 0.4, 0.15, 0.05] : [0.1, 0.3, 0.35, 0.25];
      let r = Math.random(), cumul = 0, dur = beatDur;
      for (let i = 0; i < durChoices.length; i++) {
        cumul += durWeights[i];
        if (r < cumul) { dur = durChoices[i]; break; }
      }

      // Note selection based on pattern
      let nextIdx;
      switch (profile.patterns) {
        case "ascending":
          nextIdx = prevIdx + Math.floor(Math.random() * 3);
          break;
        case "descending":
          nextIdx = prevIdx - Math.floor(Math.random() * 3);
          break;
        case "stepwise":
          nextIdx = prevIdx + (Math.random() > 0.5 ? 1 : -1);
          break;
        case "jumping":
          nextIdx = prevIdx + Math.floor(Math.random() * 5) - 2;
          break;
        case "smooth":
          nextIdx = prevIdx + (Math.random() > 0.5 ? 1 : -1) * (Math.random() > 0.7 ? 2 : 1);
          break;
        case "chromatic":
          nextIdx = prevIdx + (Math.random() > 0.5 ? 1 : -1);
          if (Math.random() > 0.7) nextIdx += Math.random() > 0.5 ? 2 : -2;
          break;
        case "wide":
          nextIdx = prevIdx + Math.floor(Math.random() * 7) - 3;
          break;
        default:
          nextIdx = prevIdx + Math.floor(Math.random() * 3) - 1;
      }

      // Wrap to scale range
      const totalNotes = intervals.length * 2;
      nextIdx = Math.max(0, Math.min(totalNotes - 1, nextIdx));
      const scaleOctaveOffset = Math.floor(nextIdx / intervals.length);
      const scaleNoteIdx = nextIdx % intervals.length;
      const midi = (octave + scaleOctaveOffset + 1) * 12 + rootIdx + intervals[scaleNoteIdx];
      const freq = 440 * Math.pow(2, (midi - 69) / 12);

      notes.push({ freq, time: t, duration: dur, midi });
      prevIdx = nextIdx;
      t += dur;
      if (t >= totalBeats * beatDur) break;
    }

    return notes;
  }

  // ======================== RAGA DATA ========================
  const SWARAS = { S: 0, R1: 1, R2: 2, G1: 3, G2: 4, M1: 5, M2: 6, P: 7, D1: 8, D2: 9, N1: 10, N2: 11 };

  const RAGAS = [
    { name: "Shankarabharanam", aka: "Bilawal / Major Scale", mood: "joyful", time: "morning",
      aroha: ["S","R2","G2","M1","P","D2","N2","S"], avaroha: ["S","N2","D2","P","M1","G2","R2","S"],
      desc: "The foundation of Carnatic music. Equivalent to Western major scale." },
    { name: "Kalyani", aka: "Yaman", mood: "devotional", time: "evening",
      aroha: ["S","R2","G2","M2","P","D2","N2","S"], avaroha: ["S","N2","D2","P","M2","G2","R2","S"],
      desc: "Auspicious and serene. One of the most popular ragas for devotional music." },
    { name: "Kharaharapriya", aka: "Kafi", mood: "romantic", time: "night",
      aroha: ["S","R2","G1","M1","P","D2","N1","S"], avaroha: ["S","N1","D2","P","M1","G1","R2","S"],
      desc: "Versatile raga with deep emotional expression." },
    { name: "Harikambhoji", aka: "Khamaj", mood: "joyful", time: "evening",
      aroha: ["S","R2","G2","M1","P","D2","N1","S"], avaroha: ["S","N1","D2","P","M1","G2","R2","S"],
      desc: "Bright and cheerful, often used in light classical and film music." },
    { name: "Mayamalavagowla", aka: "Bhairav", mood: "devotional", time: "morning",
      aroha: ["S","R1","G2","M1","P","D1","N2","S"], avaroha: ["S","N2","D1","P","M1","G2","R1","S"],
      desc: "First raga taught to students. Sacred and foundational." },
    { name: "Todi", aka: "Todi", mood: "melancholy", time: "morning",
      aroha: ["S","R1","G1","M2","P","D1","N2","S"], avaroha: ["S","N2","D1","P","M2","G1","R1","S"],
      desc: "Deep and contemplative, expresses longing and pathos." },
    { name: "Bhairavi", aka: "Bhairavi", mood: "devotional", time: "morning",
      aroha: ["S","R1","G1","M1","P","D1","N1","S"], avaroha: ["S","N1","D1","P","M1","G1","R1","S"],
      desc: "Queen of ragas. Emotional depth, devotion, surrender." },
    { name: "Mohanam", aka: "Bhoop", mood: "joyful", time: "evening",
      aroha: ["S","R2","G2","P","D2","S"], avaroha: ["S","D2","P","G2","R2","S"],
      desc: "Pentatonic raga full of sweetness and joy." },
    { name: "Hamsadhwani", aka: "Hamsadhwani", mood: "joyful", time: "evening",
      aroha: ["S","R2","G2","P","N2","S"], avaroha: ["S","N2","P","G2","R2","S"],
      desc: "Auspicious pentatonic raga used to begin concerts." },
    { name: "Hindolam", aka: "Malkauns", mood: "calm", time: "latenight",
      aroha: ["S","G1","M1","D1","N1","S"], avaroha: ["S","N1","D1","M1","G1","S"],
      desc: "Meditative and deep. Evokes stillness of late night." },
    { name: "Kalyani (Shudh)", aka: "Pure Major #4", mood: "devotional", time: "evening",
      aroha: ["S","R2","G2","M2","P","D2","N2","S"], avaroha: ["S","N2","D2","P","M2","G2","R2","S"],
      desc: "Bright, auspicious, used for invoking blessings." },
    { name: "Abhogi", aka: "Abhogi", mood: "romantic", time: "midday",
      aroha: ["S","R2","G1","M1","D2","S"], avaroha: ["S","D2","M1","G1","R2","S"],
      desc: "Sweet and compact pentatonic raga with romantic appeal." },
    { name: "Revathi", aka: "Revathi", mood: "melancholy", time: "night",
      aroha: ["S","R1","M1","P","N1","S"], avaroha: ["S","N1","P","M1","R1","S"],
      desc: "Sparse and poignant, deep pathos and separation." },
    { name: "Simhendramadhyamam", aka: "Simhendramadhyamam", mood: "heroic", time: "midday",
      aroha: ["S","R2","G1","M2","P","D1","N2","S"], avaroha: ["S","N2","D1","P","M2","G1","R2","S"],
      desc: "Grand and powerful, evoking courage and determination." },
    { name: "Charukesi", aka: "Charukesi", mood: "romantic", time: "evening",
      aroha: ["S","R2","G2","M1","P","D1","N1","S"], avaroha: ["S","N1","D1","P","M1","G2","R2","S"],
      desc: "Western-influenced sound, widely used in film music." },
    { name: "Bilahari", aka: "Bilahari", mood: "heroic", time: "morning",
      aroha: ["S","R2","G2","P","D2","S"], avaroha: ["S","N2","D2","P","M1","G2","R2","S"],
      desc: "Valor and brightness. Asymmetric ascending raga." },
    { name: "Sahana", aka: "Sahana", mood: "romantic", time: "night",
      aroha: ["S","R2","G2","M1","P","M1","D2","N2","S"], avaroha: ["S","N2","D2","P","M1","G2","R2","S"],
      desc: "Tender and amorous, expresses longing and love." },
    { name: "Anandabhairavi", aka: "Anandabhairavi", mood: "joyful", time: "morning",
      aroha: ["S","G1","R2","G1","M1","P","D2","P","S"], avaroha: ["S","N1","D2","P","M1","G1","R2","S"],
      desc: "Blissful and auspicious, popular in devotional music." },
    { name: "Amritavarshini", aka: "Malhar", mood: "calm", time: "evening",
      aroha: ["S","G2","M2","P","N2","S"], avaroha: ["S","N2","P","M2","G2","S"],
      desc: "Rain raga. Said to invoke rainfall. Serene and mystical." },
    { name: "Desh", aka: "Desh", mood: "romantic", time: "evening",
      aroha: ["S","R2","M1","P","N2","S"], avaroha: ["S","N2","D2","P","M1","G2","R2","S"],
      desc: "Patriotic and romantic. Popular in North Indian light music." },
    { name: "Yaman Kalyan", aka: "Yaman", mood: "calm", time: "evening",
      aroha: ["S","R2","G2","M2","P","D2","N2","S"], avaroha: ["S","N2","D2","P","M2","G2","R2","S"],
      desc: "First raga taught in Hindustani music. Peaceful and devotional." },
    { name: "Bageshree", aka: "Bageshree", mood: "romantic", time: "night",
      aroha: ["S","G1","M1","D1","N1","S"], avaroha: ["S","N1","D1","M1","G1","R2","S"],
      desc: "Night raga par excellence. Deep romantic longing." },
    { name: "Durga", aka: "Durga", mood: "devotional", time: "night",
      aroha: ["S","R2","M1","P","D2","S"], avaroha: ["S","D2","P","M1","R2","S"],
      desc: "Named after the goddess. Simple and powerful." },
    { name: "Kambhoji", aka: "Kambhoji", mood: "heroic", time: "evening",
      aroha: ["S","R2","G2","M1","P","D2","S"], avaroha: ["S","N1","D2","P","M1","G2","R2","S"],
      desc: "Majestic and heroic, one of the greatest ragas." },
  ];

  function swaraToSemitone(swara) { return SWARAS[swara] ?? 0; }

  function ragaNotesToFreqs(swaras, baseFreq) {
    return swaras.map(s => {
      let st = swaraToSemitone(s);
      if (s === "S" && swaras.indexOf(s) === swaras.length - 1) st = 12;
      return baseFreq * Math.pow(2, st / 12);
    });
  }

  // ======================== BEAT PATTERNS ========================
  const DRUM_ROWS = ["kick", "snare", "hihat", "openhat", "clap", "tom", "rim", "shaker"];
  const DRUM_LABELS = { kick: "Kick", snare: "Snare", hihat: "Hi-Hat", openhat: "Open Hat", clap: "Clap", tom: "Tom", rim: "Rim", shaker: "Shaker" };

  const BEAT_PRESETS = {
    rock: {
      kick:   [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      snare:  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      hihat:  [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    },
    hiphop: {
      kick:   [1,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0],
      snare:  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      hihat:  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      openhat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
    },
    jazz: {
      kick:   [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],
      snare:  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      hihat:  [1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,0],
      rim:    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
    },
    latin: {
      kick:   [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0],
      clap:   [0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1],
      shaker: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      tom:    [0,0,1,0,0,0,1,0,0,0,1,0,0,1,0,0],
    },
    edm: {
      kick:   [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      clap:   [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      hihat:  [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
      openhat:[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
    },
    bollywood: {
      kick:   [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],
      snare:  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      hihat:  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      tom:    [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
    },
    classical: {
      kick:   [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
      tom:    [0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0],
      shaker: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    },
  };

  // ======================== STATE ========================
  let currentTab = "mood";
  let selectedMood = null;
  let moodPlaying = false;
  let moodTimeout = null;
  let beatPlaying = false;
  let beatInterval = null;
  let beatStep = 0;
  let beatGrid = {};
  let ragaPlaying = false;
  let ragaTimeouts = [];
  const STEPS = 16;

  // ======================== TAB NAVIGATION ========================
  function initTabs() {
    const links = document.querySelectorAll(".nav-links a[data-tab]");
    links.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        switchTab(tab);
      });
    });
    switchTab("mood");
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    const panel = document.getElementById("tab-" + tab);
    if (panel) panel.classList.add("active");
    document.querySelectorAll(".nav-links a[data-tab]").forEach(a => {
      a.classList.toggle("active", a.dataset.tab === tab);
    });
  }

  // ======================== HERO VISUALIZER ========================
  function initHeroVisualizer() {
    const container = document.getElementById("heroVisualizer");
    if (!container) return;
    const barCount = 40;
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement("div");
      bar.className = "hero-bar";
      bar.style.height = "10px";
      container.appendChild(bar);
    }
    animateHeroBars(container);
  }

  function animateHeroBars(container) {
    const bars = container.querySelectorAll(".hero-bar");
    function update() {
      bars.forEach((bar, i) => {
        const h = 10 + Math.sin(Date.now() / 300 + i * 0.5) * 25 + Math.random() * 15;
        bar.style.height = h + "px";
      });
      requestAnimationFrame(update);
    }
    update();
  }

  // ======================== MOOD COMPOSER ========================
  function initMoodComposer() {
    const grid = document.getElementById("moodGrid");
    if (!grid) return;

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".mood-card");
      if (!card) return;
      document.querySelectorAll(".mood-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedMood = card.dataset.mood;

      // Auto-set recommended scale/tempo
      const profile = MOOD_PROFILES[selectedMood];
      if (profile) {
        document.getElementById("moodTempo").value = profile.tempo;
        document.getElementById("moodTempoVal").textContent = profile.tempo + " BPM";
        document.getElementById("moodScale").value = profile.scale;
      }
    });

    // Tempo slider
    const tempoSlider = document.getElementById("moodTempo");
    tempoSlider.addEventListener("input", () => {
      document.getElementById("moodTempoVal").textContent = tempoSlider.value + " BPM";
    });

    // Generate
    document.getElementById("moodGenerate").addEventListener("click", () => {
      if (!selectedMood) {
        alert("Please select a mood first!");
        return;
      }
      initAudio();
      const key = document.getElementById("moodKey").value;
      const scale = document.getElementById("moodScale").value;
      const tempo = parseInt(tempoSlider.value);
      const bars = parseInt(document.getElementById("moodDuration").value);
      playMoodMelody(selectedMood, key, scale, tempo, bars);
    });

    // Stop
    document.getElementById("moodStop").addEventListener("click", stopMoodMelody);
  }

  function playMoodMelody(mood, key, scale, tempo, bars) {
    stopMoodMelody();
    moodPlaying = true;
    document.getElementById("moodStop").disabled = false;
    document.getElementById("moodVisualizer").style.display = "block";

    const notes = generateMelody(mood, key, scale, tempo, bars);
    const canvas = document.getElementById("moodCanvas");
    const nowPlaying = document.getElementById("moodNowPlaying");
    nowPlaying.textContent = `🎵 Playing: ${mood.charAt(0).toUpperCase() + mood.slice(1)} in ${key} ${scale} @ ${tempo} BPM`;

    const startTime = ctx.currentTime + 0.1;
    notes.forEach(note => {
      playNote(note.freq, note.duration * 0.9, "triangle", startTime + note.time, 0.25);
    });

    // Visualizer
    startCanvasVisualizer(canvas);

    const totalDur = notes.length > 0 ? notes[notes.length - 1].time + notes[notes.length - 1].duration + 0.5 : 2;
    moodTimeout = setTimeout(() => {
      stopMoodMelody();
      nowPlaying.textContent = "✓ Playback complete";
    }, totalDur * 1000);
  }

  function stopMoodMelody() {
    moodPlaying = false;
    if (moodTimeout) { clearTimeout(moodTimeout); moodTimeout = null; }
    document.getElementById("moodStop").disabled = true;
  }

  // ======================== RAGA EXPLORER ========================
  function initRagaExplorer() {
    renderRagaGrid(RAGAS);

    document.getElementById("ragaSearch").addEventListener("input", filterRagas);
    document.getElementById("ragaMoodFilter").addEventListener("change", filterRagas);
    document.getElementById("ragaTimeFilter").addEventListener("change", filterRagas);
    document.getElementById("ragaDetailClose").addEventListener("click", () => {
      document.getElementById("ragaDetail").style.display = "none";
      stopRagaPlay();
    });
    document.getElementById("ragaPlayAroha").addEventListener("click", () => playRagaNotes("aroha"));
    document.getElementById("ragaPlayAvaro").addEventListener("click", () => playRagaNotes("avaroha"));
    document.getElementById("ragaGeneratePhrase").addEventListener("click", generateRagaPhrase);
    document.getElementById("ragaStopPlay").addEventListener("click", stopRagaPlay);
  }

  function filterRagas() {
    const search = document.getElementById("ragaSearch").value.toLowerCase();
    const mood = document.getElementById("ragaMoodFilter").value;
    const time = document.getElementById("ragaTimeFilter").value;
    const filtered = RAGAS.filter(r => {
      if (search && !r.name.toLowerCase().includes(search) && !(r.aka && r.aka.toLowerCase().includes(search))) return false;
      if (mood !== "all" && r.mood !== mood) return false;
      if (time !== "all" && r.time !== time) return false;
      return true;
    });
    renderRagaGrid(filtered);
  }

  function renderRagaGrid(ragas) {
    const grid = document.getElementById("ragaGrid");
    if (!grid) return;
    if (ragas.length === 0) {
      grid.innerHTML = '<p style="color:var(--muted);text-align:center;padding:32px">No ragas match your filters</p>';
      return;
    }
    grid.innerHTML = ragas.map((r, i) => `
      <div class="raga-card" data-index="${RAGAS.indexOf(r)}">
        <div class="raga-card-name">${esc(r.name)}</div>
        <div class="raga-card-mood">${esc(r.mood)} · ${esc(r.time)}</div>
        <div class="raga-card-notes">${esc(r.aroha.join(" "))}</div>
      </div>
    `).join("");

    grid.querySelectorAll(".raga-card").forEach(card => {
      card.addEventListener("click", () => showRagaDetail(parseInt(card.dataset.index)));
    });
  }

  let selectedRaga = null;
  function showRagaDetail(index) {
    initAudio();
    selectedRaga = RAGAS[index];
    if (!selectedRaga) return;
    document.getElementById("ragaDetail").style.display = "block";
    document.getElementById("ragaName").textContent = selectedRaga.name;
    document.getElementById("ragaMeta").innerHTML = `
      <span>🎭 ${esc(selectedRaga.mood)}</span>
      <span>🕐 ${esc(selectedRaga.time)}</span>
      ${selectedRaga.aka ? `<span>📝 ${esc(selectedRaga.aka)}</span>` : ""}
    `;
    document.getElementById("ragaArohanam").textContent = selectedRaga.aroha.join("  ");
    document.getElementById("ragaAvarohanam").textContent = selectedRaga.avaroha.join("  ");
    document.getElementById("ragaDetail").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function playRagaNotes(direction) {
    if (!selectedRaga || !ctx) return;
    stopRagaPlay();
    ragaPlaying = true;
    const swaras = direction === "aroha" ? selectedRaga.aroha : selectedRaga.avaroha;
    const baseFreq = 261.63; // C4 (Sa)
    const freqs = ragaNotesToFreqs(swaras, baseFreq);
    const dur = 0.5;
    const canvas = document.getElementById("ragaCanvas");
    startCanvasVisualizer(canvas);

    freqs.forEach((f, i) => {
      const tid = setTimeout(() => {
        if (!ragaPlaying) return;
        playNote(f, dur * 0.9, "triangle", ctx.currentTime, 0.3);
      }, i * dur * 1000);
      ragaTimeouts.push(tid);
    });

    ragaTimeouts.push(setTimeout(() => { ragaPlaying = false; }, freqs.length * dur * 1000 + 500));
  }

  function generateRagaPhrase() {
    if (!selectedRaga || !ctx) return;
    stopRagaPlay();
    ragaPlaying = true;
    const allSwaras = [...selectedRaga.aroha.slice(0, -1), ...selectedRaga.avaroha.slice(0, -1)];
    const baseFreq = 261.63;
    const phraseLen = 12 + Math.floor(Math.random() * 8);
    const phrase = [];
    let prev = 0;
    for (let i = 0; i < phraseLen; i++) {
      let next = prev + Math.floor(Math.random() * 3) - 1;
      next = Math.max(0, Math.min(allSwaras.length - 1, next));
      phrase.push(allSwaras[next]);
      prev = next;
    }
    const freqs = ragaNotesToFreqs(phrase, baseFreq);
    const dur = 0.35;
    const canvas = document.getElementById("ragaCanvas");
    startCanvasVisualizer(canvas);

    freqs.forEach((f, i) => {
      const tid = setTimeout(() => {
        if (!ragaPlaying) return;
        playNote(f, dur * 0.85, "triangle", ctx.currentTime, 0.3);
      }, i * dur * 1000);
      ragaTimeouts.push(tid);
    });
    ragaTimeouts.push(setTimeout(() => { ragaPlaying = false; }, freqs.length * dur * 1000 + 500));
  }

  function stopRagaPlay() {
    ragaPlaying = false;
    ragaTimeouts.forEach(t => clearTimeout(t));
    ragaTimeouts = [];
  }

  // ======================== BEAT MAKER ========================
  function initBeatMaker() {
    buildSequencer();

    document.getElementById("beatTempo").addEventListener("input", (e) => {
      document.getElementById("beatTempoVal").textContent = e.target.value + " BPM";
    });
    document.getElementById("beatSwing").addEventListener("input", (e) => {
      document.getElementById("beatSwingVal").textContent = e.target.value + "%";
    });
    document.getElementById("beatPattern").addEventListener("change", (e) => {
      if (e.target.value !== "custom") loadPreset(e.target.value);
    });
    document.getElementById("beatPlay").addEventListener("click", startBeat);
    document.getElementById("beatStop").addEventListener("click", stopBeat);
    document.getElementById("beatClear").addEventListener("click", clearBeat);
    document.getElementById("beatRandomize").addEventListener("click", randomizeBeat);
  }

  function buildSequencer() {
    const headerEl = document.getElementById("seqStepsHeader");
    const rowsEl = document.getElementById("seqRows");
    headerEl.innerHTML = "";
    rowsEl.innerHTML = "";

    for (let s = 0; s < STEPS; s++) {
      const num = document.createElement("div");
      num.className = "seq-step-num" + (s % 4 === 0 ? " beat" : "");
      num.textContent = s + 1;
      headerEl.appendChild(num);
    }

    DRUM_ROWS.forEach(drum => {
      beatGrid[drum] = new Array(STEPS).fill(0);
      const row = document.createElement("div");
      row.className = "seq-row";
      row.innerHTML = `<div class="seq-row-label">${DRUM_LABELS[drum]}</div><div class="seq-row-steps" data-drum="${drum}"></div>`;
      const stepsContainer = row.querySelector(".seq-row-steps");
      for (let s = 0; s < STEPS; s++) {
        const cell = document.createElement("div");
        cell.className = "seq-cell";
        cell.dataset.step = s;
        cell.dataset.drum = drum;
        cell.addEventListener("click", () => toggleCell(drum, s, cell));
        stepsContainer.appendChild(cell);
      }
      rowsEl.appendChild(row);
    });
  }

  function toggleCell(drum, step, cell) {
    beatGrid[drum][step] = beatGrid[drum][step] ? 0 : 1;
    cell.classList.toggle("active");
    cell.classList.toggle(drum);
  }

  function loadPreset(name) {
    const preset = BEAT_PRESETS[name];
    if (!preset) return;
    clearBeat();
    DRUM_ROWS.forEach(drum => {
      if (preset[drum]) {
        beatGrid[drum] = [...preset[drum]];
        const cells = document.querySelectorAll(`.seq-cell[data-drum="${drum}"]`);
        cells.forEach((cell, i) => {
          if (preset[drum][i]) {
            cell.classList.add("active", drum);
          }
        });
      }
    });
  }

  function clearBeat() {
    DRUM_ROWS.forEach(drum => {
      beatGrid[drum] = new Array(STEPS).fill(0);
    });
    document.querySelectorAll(".seq-cell").forEach(c => {
      c.className = "seq-cell";
    });
  }

  function randomizeBeat() {
    clearBeat();
    DRUM_ROWS.forEach(drum => {
      const density = drum === "kick" ? 0.3 : drum === "hihat" ? 0.5 : 0.15;
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

    function tick() {
      if (!beatPlaying) return;
      const tempo = parseInt(document.getElementById("beatTempo").value);
      const swing = parseInt(document.getElementById("beatSwing").value) / 100;
      const stepDur = (60 / tempo) / 4;
      const swingOffset = (beatStep % 2 === 1) ? stepDur * swing * 0.3 : 0;

      // Highlight current step
      document.querySelectorAll(".seq-cell.playing").forEach(c => c.classList.remove("playing"));
      document.querySelectorAll(`.seq-cell[data-step="${beatStep}"]`).forEach(c => c.classList.add("playing"));

      // Play active drums
      DRUM_ROWS.forEach(drum => {
        if (beatGrid[drum][beatStep]) {
          playDrum(drum, ctx.currentTime + swingOffset);
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

  // ======================== FREE PLAY (KEYBOARD) ========================
  const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
  const BLACK_NOTES = { 0: "C#", 1: "D#", 3: "F#", 4: "G#", 5: "A#" };
  const KEY_MAP = {
    a: 0, s: 1, d: 2, f: 3, g: 4, h: 5, j: 6, k: 7,  // white
    w: "C#", e: "D#", t: "F#", y: "G#", u: "A#",       // black
  };

  function initFreePlay() {
    buildKeyboard();

    document.getElementById("fpVolume").addEventListener("input", (e) => {
      document.getElementById("fpVolumeVal").textContent = e.target.value + "%";
      if (masterGain) masterGain.gain.value = e.target.value / 100;
    });
    document.getElementById("fpReverb").addEventListener("input", (e) => {
      document.getElementById("fpReverbVal").textContent = e.target.value + "%";
    });

    // Keyboard input
    const activeKeys = new Set();
    document.addEventListener("keydown", (e) => {
      if (currentTab !== "freeplay" || e.repeat) return;
      const k = e.key.toLowerCase();
      if (activeKeys.has(k)) return;
      activeKeys.add(k);
      handleKeyPress(k, true);
    });
    document.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      activeKeys.delete(k);
      handleKeyPress(k, false);
    });

    // Canvas vis
    const canvas = document.getElementById("fpCanvas");
    startCanvasVisualizer(canvas);
  }

  function buildKeyboard() {
    const kb = document.getElementById("keyboard");
    if (!kb) return;
    kb.innerHTML = "";

    WHITE_NOTES.forEach((note, i) => {
      const key = document.createElement("div");
      key.className = "key key-white";
      key.dataset.note = note;
      key.textContent = note;
      key.addEventListener("mousedown", () => {
        initAudio();
        triggerFreeNote(note, true);
        key.classList.add("active");
      });
      key.addEventListener("mouseup", () => key.classList.remove("active"));
      key.addEventListener("mouseleave", () => key.classList.remove("active"));
      kb.appendChild(key);

      // Black key
      if (BLACK_NOTES[i] !== undefined) {
        const bkey = document.createElement("div");
        bkey.className = "key key-black";
        bkey.dataset.note = BLACK_NOTES[i];
        bkey.textContent = BLACK_NOTES[i];
        bkey.addEventListener("mousedown", () => {
          initAudio();
          triggerFreeNote(BLACK_NOTES[i], true);
          bkey.classList.add("active");
        });
        bkey.addEventListener("mouseup", () => bkey.classList.remove("active"));
        bkey.addEventListener("mouseleave", () => bkey.classList.remove("active"));
        kb.appendChild(bkey);
      }
    });
  }

  function handleKeyPress(k, isDown) {
    if (KEY_MAP[k] === undefined) return;
    initAudio();
    let note;
    if (typeof KEY_MAP[k] === "number") {
      note = WHITE_NOTES[KEY_MAP[k]];
    } else {
      note = KEY_MAP[k];
    }
    const keyEl = document.querySelector(`.key[data-note="${note}"]`);
    if (isDown) {
      triggerFreeNote(note, true);
      if (keyEl) keyEl.classList.add("active");
    } else {
      if (keyEl) keyEl.classList.remove("active");
    }
  }

  function triggerFreeNote(note, play) {
    if (!play || !ctx) return;
    const octave = parseInt(document.getElementById("fpOctave").value);
    const instrument = document.getElementById("fpInstrument").value;
    const vol = parseInt(document.getElementById("fpVolume").value) / 100 * 0.4;
    const freq = noteFreq(note, octave);
    playInstrumentNote(freq, 0.8, instrument, ctx.currentTime, vol);
  }

  // ======================== CANVAS VISUALIZER ========================
  function startCanvasVisualizer(canvas) {
    if (!canvas) return;
    const canvasCtx = canvas.getContext("2d");
    function draw() {
      requestAnimationFrame(draw);
      if (!analyser) return;
      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(data);

      canvasCtx.fillStyle = "#1a1a24";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barW = (canvas.width / bufLen) * 2.5;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const h = (data[i] / 255) * canvas.height * 0.9;
        const hue = 260 + (i / bufLen) * 60;
        canvasCtx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
        canvasCtx.fillRect(x, canvas.height - h, barW - 1, h);
        x += barW;
      }
    }
    draw();
  }

  // ======================== MOBILE NAV ========================
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

  // ======================== UTIL ========================
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ======================== INIT ========================
  function init() {
    initNav();
    initTabs();
    initHeroVisualizer();
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
