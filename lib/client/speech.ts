"use client";

// Speaks with the browser's built-in voices. Call speak() straight from a click or submit handler:
// browsers only allow speech after a user action. Browsers without speech stay silent.

// Natural-sounding female English voices across macOS, Windows/Edge, Chrome and Android, best first.
const FEMALE_VOICES = [
  /natural.*(aria|jenny|sonia|libby|michelle|emma|ava)/i,
  /(aria|jenny|sonia|libby|michelle|emma|ava).*online/i,
  /samantha|ava|allison|susan|victoria|karen|moira|tessa|fiona|serena/i,
  /google us english/i, // Chrome's default US voice is female
  /google uk english female/i,
  /female/i,
  /zira|hazel|catherine/i,
];

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const pattern of FEMALE_VOICES) {
    const match = english.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  return undefined;
}

export function speak(text: string): void {
  try {
    const speech = window.speechSynthesis;
    if (!speech) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.97;
    utterance.pitch = 1.05;

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      speech.removeEventListener("voiceschanged", start);
      const voice = pickVoice(speech.getVoices());
      if (voice) utterance.voice = voice;
      speech.cancel();
      speech.speak(utterance);
    };
    // Chrome loads its voice list late; wait briefly for it, then speak with the default voice.
    if (speech.getVoices().length > 0) start();
    else {
      speech.addEventListener("voiceschanged", start);
      setTimeout(start, 600);
    }
  } catch {
    // Speech unavailable or blocked: carry on silently.
  }
}
