let audio: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  if (!audio) audio = new AudioContext();
  return audio;
}

export function unlockAlarm() {
  const current = context();
  if (current?.state === "suspended") void current.resume();
}

export function alarmReady() {
  return context()?.state === "running";
}

export function playAlarm() {
  const current = context();
  if (!current || current.state !== "running") return false;

  tone(current, 880, 0);
  tone(current, 660, 0.2);
  return true;
}

function tone(current: AudioContext, frequency: number, offset: number) {
  const start = current.currentTime + offset;
  const oscillator = current.createOscillator();
  const gain = current.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  oscillator.connect(gain);
  gain.connect(current.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.2);
}
