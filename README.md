# Triangle Chain -- React Native / Expo

A native port of the web prototype: same game logic, now rendered with real
native 3D (expo-gl + Three.js) and a physical-feeling drag-to-stretch rubber
band gesture (react-native-gesture-handler + expo-haptics + baked sound
effects).

## Honest disclaimer

This was written and reviewed carefully, but **not run** -- there's no
Expo/React Native toolchain or physical device available in the environment
that built it. The pure game logic (`src/game/logic.js`) is a straight copy
of the already-tested web version, so that part should just work. The native
glue -- `expo-gl` context setup, gesture composition, haptics, sound loading
-- is written against current, verified API shapes, but it hasn't touched a
real device yet. Expect to do one round of "run it, see what breaks, tell
me" the same way we did for the 3D web rewrite.

One thing worth knowing up front: **Three.js in expo-gl does not run well in
the iOS Simulator or Android Emulator** -- test on a real phone.

## 1. Create the project

```bash
npx create-expo-app triangle-chain-rn
cd triangle-chain-rn
```

## 2. Install dependencies

```bash
npx expo install expo-gl expo-three three expo-av expo-haptics \
  react-native-gesture-handler react-native-safe-area-context
```

`expo install` (rather than plain `npm install`) picks the exact versions
that match whatever Expo SDK you land on -- this avoids me hardcoding
version numbers that may already be stale by the time you read this.

If anything looks mismatched later, `npx expo install --fix` will
re-resolve everything against your installed SDK.

## 3. Copy in these files

Copy this project's contents into your new project, **overwriting**
`App.js`, `babel.config.js`, `app.json`, and `package.json`'s `dependencies`
block if you want to keep your freshly-resolved version numbers instead of
mine, and add:

```
src/
assets/sfx/
metro.config.js
```

## 4. Run it

```bash
npx expo start
```

Scan the QR code with Expo Go on a physical device (or run
`npx expo run:ios` / `npx expo run:android` for a full native build once
you're past quick iteration).

## What's the same as the web version

- All game logic -- board geometry, move validation, AI, scoring, win
  condition -- is `src/game/logic.js`, ported unchanged.
- The rubber-band interaction model: press a peg, drag to elastically
  stretch a spring-damped band, snap onto a legal peg or retract if you let
  go elsewhere.
- Orbit-drag on empty board space, pinch to zoom.

## What's different / native-specific

- **Sound**: React Native has no Web Audio oscillator API, so the four cues
  (tick / commit / claim / retract) are baked WAV files in `assets/sfx/`,
  generated to match the same pitches/envelopes as the web version's
  synthesized tones.
- **Haptics**: real `expo-haptics` impacts instead of the web version's
  best-effort `navigator.vibrate` -- a light tap when the band catches a
  peg, a success notification when a move commits, a light tap on retract.
- **Gestures**: `react-native-gesture-handler`'s `Gesture.Pan` +
  `Gesture.Pinch` composed together, instead of raw DOM pointer events.
  Two-finger pinch is handled by RNGH's built-in scale tracking rather than
  the manual two-pointer-distance math the web version needed.
- **Rendering**: `expo-gl` + `expo-three`'s `Renderer` wraps a real native
  WebGL context; the render loop calls `gl.endFrameEXP()` each frame, which
  is expo-gl-specific.

## Things to specifically check on a real device

- **Gesture edge cases**: what happens if a second finger touches down
  mid-stretch (should cancel/retract the band), and what happens releasing
  one finger of a two-finger pinch (should resume single-finger orbit
  smoothly). These are handled in code but are exactly the kind of thing
  that needs a thumb on real glass to confirm feels right.
- **Spring tuning**: the stretch/snap/release stiffness and damping values
  in `Board3D.js` were carried over from the web version's constants. Native
  touch latency is usually lower than a browser's, so these may want
  retuning once you can feel it.
- **Performance on Large boards**: the "Large" board size generates ~190
  individual triangle meshes plus ~150 pegs and hit-spheres. This was fine
  in WebGL on desktop/mobile browsers; native GPUs vary more, so if a
  mid-range Android device chugs on Large, the fix is batching the static
  faces into one merged `BufferGeometry` instead of ~190 separate meshes
  (straightforward to do, just didn't want to add that complexity before
  confirming it's actually needed).
- **Sound latency**: `expo-av`'s `replayAsync()` on a shared `Sound`
  instance can have a small delay on some Android devices compared to iOS.
  If the tick sound feels laggy against the haptic during a fast drag,
  that's the usual suspect -- the fix is a small pool of pre-loaded
  `Sound` instances per effect instead of one shared instance.
