import { useEffect, useRef, useCallback } from "react";
import { Audio } from "expo-av";

// Web Audio's oscillator API doesn't exist on native, so these are short
// baked WAV files (see assets/sfx) tuned to match the pitches/envelopes used
// in the web prototype: a light "tick" while a stretch snaps toward a legal
// peg, a "commit" thunk when a band locks in, a soft "retract" blip when a
// stretch is let go with no target, and a 3-note ascending "claim" chime.
const SOURCES = {
  tick: require("../../assets/sfx/tick.wav"),
  commit: require("../../assets/sfx/commit.wav"),
  retract: require("../../assets/sfx/retract.wav"),
  claim: require("../../assets/sfx/claim.wav"),
};

export function useSynth(enabled) {
  const soundsRef = useRef({});
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const entries = await Promise.all(
          Object.entries(SOURCES).map(async ([key, src]) => {
            const { sound } = await Audio.Sound.createAsync(src);
            return [key, sound];
          })
        );
        if (mounted) {
          entries.forEach(([key, sound]) => {
            soundsRef.current[key] = sound;
          });
        } else {
          entries.forEach(([, sound]) => sound.unloadAsync().catch(() => {}));
        }
      } catch (e) {
        // Sound is a nice-to-have -- the game is fully playable without it.
      }
    })();

    return () => {
      mounted = false;
      Object.values(soundsRef.current).forEach((s) => s.unloadAsync().catch(() => {}));
      soundsRef.current = {};
    };
  }, []);

  const play = useCallback((key) => {
    if (!enabledRef.current) return;
    const sound = soundsRef.current[key];
    if (!sound) return;
    sound.replayAsync().catch(() => {});
  }, []);

  return {
    tick: useCallback(() => play("tick"), [play]),
    commit: useCallback(() => play("commit"), [play]),
    retract: useCallback(() => play("retract"), [play]),
    claim: useCallback(() => play("claim"), [play]),
  };
}
