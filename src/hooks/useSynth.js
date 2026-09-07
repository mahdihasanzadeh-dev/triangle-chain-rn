import { useEffect, useRef, useCallback } from "react";
import { Asset } from "expo-asset";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

// expo-av is deprecated; expo-audio is its replacement. One gotcha worth
// knowing: locally require()'d audio assets can silently fail to play in
// release builds unless resolved to a real file:// URI via expo-asset
// first -- Asset.loadAsync() below is what makes that reliable.
const SOURCES = {
  tick: require("../../assets/sfx/tick.wav"),
  commit: require("../../assets/sfx/commit.wav"),
  retract: require("../../assets/sfx/retract.wav"),
  claim: require("../../assets/sfx/claim.wav"),
};

export function useSynth(enabled) {
  const playersRef = useRef({});
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: false,
        });
        const entries = await Promise.all(
          Object.entries(SOURCES).map(async ([key, src]) => {
            const [asset] = await Asset.loadAsync(src);
            const uri = asset.localUri || asset.uri;
            const player = createAudioPlayer(uri);
            return [key, player];
          })
        );
        if (mounted) {
          entries.forEach(([key, player]) => {
            playersRef.current[key] = player;
          });
        } else {
          entries.forEach(([, player]) => {
            try {
              player.remove();
            } catch (e) {
              /* already gone */
            }
          });
        }
      } catch (e) {
        // Sound is a nice-to-have -- the game is fully playable without it.
      }
    })();

    return () => {
      mounted = false;
      Object.values(playersRef.current).forEach((p) => {
        try {
          p.remove();
        } catch (e) {
          /* already gone */
        }
      });
      playersRef.current = {};
    };
  }, []);

  const play = useCallback((key) => {
    if (!enabledRef.current) return;
    const player = playersRef.current[key];
    if (!player) return;
    try {
      // expo-audio, unlike expo-av, doesn't auto-reset position when a clip
      // finishes -- seekTo(0) before every play() is the documented way to
      // get "replay from the start" behavior for a short one-shot sound.
      player.seekTo(0);
      player.play();
    } catch (e) {
      /* best effort */
    }
  }, []);

  return {
    tick: useCallback(() => play("tick"), [play]),
    commit: useCallback(() => play("commit"), [play]),
    retract: useCallback(() => play("retract"), [play]),
    claim: useCallback(() => play("claim"), [play]),
  };
}
