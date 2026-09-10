import React, { useRef, useMemo, useState, useCallback } from "react";
import { View } from "react-native";
import { Canvas, Path, Circle, Skia } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

const PEG_R = 7;
const PEG_HIT_R = 24;
const BAND_WIDTH = 5;
const DRAG_BAND_WIDTH = 4;
const WOOD_COLOR = "#241a12";
const BRASS_COLOR = "#c9a35c";
const DIM_COLOR = "#362c1e";

const hapticLight = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
const hapticSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

function makeLinePath(x1, y1, x2, y2) {
  const p = Skia.Path.Make();
  p.moveTo(x1, y1);
  p.lineTo(x2, y2);
  return p;
}

export default function Board2D({
  board,
  game,
  selectedStart,
  validTargets,
  hoverVertex,
  canInteract,
  bandColor,
  onDragStart,
  onDragEnd,
  onHoverVertex,
  onSnapTick,
  onRetract,
}) {
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const onLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  // ---- lattice (board.viewBox units) -> screen pixel transform ----
  const transform = useMemo(() => {
    const vb = board.viewBox;
    const scale = Math.min(layout.width / vb.w, layout.height / vb.h) || 1;
    return {
      scale,
      offsetX: (layout.width - vb.w * scale) / 2 - vb.minX * scale,
      offsetY: (layout.height - vb.h * scale) / 2 - vb.minY * scale,
    };
  }, [board, layout]);

  const toScreen = useCallback(
    (x, y) => ({ x: x * transform.scale + transform.offsetX, y: y * transform.scale + transform.offsetY }),
    [transform]
  );

  const vertexScreen = useMemo(() => {
    const map = new Map();
    board.vertices.forEach((v, key) => map.set(key, toScreen(v.x, v.y)));
    return map;
  }, [board, toScreen]);

  const facePaths = useMemo(
    () =>
      board.faces.map((f) => {
        const pts = f.verts.map((k) => vertexScreen.get(k));
        const p = Skia.Path.Make();
        p.moveTo(pts[0].x, pts[0].y);
        p.lineTo(pts[1].x, pts[1].y);
        p.lineTo(pts[2].x, pts[2].y);
        p.close();
        return p;
      }),
    [board, vertexScreen]
  );

  const trayPathA = useMemo(() => {
    const pts = board.cornersA.map((c) => toScreen(c.x, c.y));
    const p = Skia.Path.Make();
    p.moveTo(pts[0].x, pts[0].y);
    p.lineTo(pts[1].x, pts[1].y);
    p.lineTo(pts[2].x, pts[2].y);
    p.close();
    return p;
  }, [board, toScreen]);

  const trayPathB = useMemo(() => {
    const pts = board.cornersB.map((c) => toScreen(c.x, c.y));
    const p = Skia.Path.Make();
    p.moveTo(pts[0].x, pts[0].y);
    p.lineTo(pts[1].x, pts[1].y);
    p.lineTo(pts[2].x, pts[2].y);
    p.close();
    return p;
  }, [board, toScreen]);

  const bandPaths = useMemo(
    () =>
      game.bands.map((b) => {
        const p1 = toScreen(b.x1, b.y1);
        const p2 = toScreen(b.x2, b.y2);
        return { id: b.id, color: b.color, path: makeLinePath(p1.x, p1.y, p2.x, p2.y) };
      }),
    [game.bands, toScreen]
  );

  // ---- live drag band: plain React state + a hand-rolled spring loop
  //      (same math as the earlier Three.js version, just 2D and driving
  //      React state instead of mesh transforms) ----
  const [dragBand, setDragBand] = useState(null);
  const springRef = useRef({ pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, target: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, mode: "idle" });
  const rafRef = useRef(null);
  const lastTRef = useRef(0);
  const stretchRef = useRef({ startKey: null, targetKey: null, active: false });

  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const onHoverVertexRef = useRef(onHoverVertex);
  onHoverVertexRef.current = onHoverVertex;
  const onSnapTickRef = useRef(onSnapTick);
  onSnapTickRef.current = onSnapTick;
  const onRetractRef = useRef(onRetract);
  onRetractRef.current = onRetract;
  const validTargetsRef = useRef(validTargets);
  validTargetsRef.current = validTargets;
  const canInteractRef = useRef(canInteract);
  canInteractRef.current = canInteract;
  const bandColorRef = useRef(bandColor);
  bandColorRef.current = bandColor;
  const vertexScreenRef = useRef(vertexScreen);
  vertexScreenRef.current = vertexScreen;

  const stopSpringLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startSpringLoop = useCallback(() => {
    stopSpringLoop();
    lastTRef.current = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - lastTRef.current) / 1000);
      lastTRef.current = now;
      const s = springRef.current;
      const releasing = s.mode === "release";
      const stiffness = releasing ? 170 : s.mode === "snap" ? 320 : 260;
      const damping = releasing ? 9 : s.mode === "snap" ? 16 : 22;
      const ax = (s.target.x - s.pos.x) * stiffness - s.vel.x * damping;
      const ay = (s.target.y - s.pos.y) * stiffness - s.vel.y * damping;
      s.vel.x += ax * dt;
      s.vel.y += ay * dt;
      s.pos.x += s.vel.x * dt;
      s.pos.y += s.vel.y * dt;

      const dx = s.pos.x - s.anchor.x;
      const dy = s.pos.y - s.anchor.y;
      if (releasing && dx * dx + dy * dy < 4) {
        setDragBand(null);
        stopSpringLoop();
        return;
      }
      setDragBand({ x1: s.anchor.x, y1: s.anchor.y, x2: s.pos.x, y2: s.pos.y, color: bandColorRef.current });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopSpringLoop]);

  const pickNearestValidPeg = useCallback((x, y) => {
    const valid = validTargetsRef.current;
    if (!valid) return null;
    let best = null;
    let bestD = PEG_HIT_R * PEG_HIT_R * 2.2;
    valid.forEach((key) => {
      const p = vertexScreenRef.current.get(key);
      if (!p) return;
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = key;
      }
    });
    return best;
  }, []);

  const pickAnyPeg = useCallback((x, y) => {
    let best = null;
    let bestD = PEG_HIT_R * PEG_HIT_R;
    vertexScreenRef.current.forEach((p, key) => {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = key;
      }
    });
    return best;
  }, []);

  const beginStretch = useCallback(
    (key) => {
      const p0 = vertexScreenRef.current.get(key);
      if (!p0) return;
      stretchRef.current = { startKey: key, targetKey: null, active: true };
      springRef.current = {
        pos: { x: p0.x, y: p0.y },
        vel: { x: 0, y: 0 },
        target: { x: p0.x, y: p0.y },
        anchor: { x: p0.x, y: p0.y },
        mode: "follow",
      };
      setDragBand({ x1: p0.x, y1: p0.y, x2: p0.x, y2: p0.y, color: bandColorRef.current });
      startSpringLoop();
      onDragStartRef.current && onDragStartRef.current(key);
    },
    [startSpringLoop]
  );

  const updateStretch = useCallback(
    (x, y) => {
      const st = stretchRef.current;
      if (!st.active) return;
      const key = pickNearestValidPeg(x, y);
      const s = springRef.current;
      if (key) {
        if (key !== st.targetKey) {
          st.targetKey = key;
          onHoverVertexRef.current && onHoverVertexRef.current(key);
          onSnapTickRef.current && onSnapTickRef.current();
          hapticLight();
        }
        const p = vertexScreenRef.current.get(key);
        s.target.x = p.x;
        s.target.y = p.y;
        s.mode = "snap";
      } else {
        if (st.targetKey !== null) {
          st.targetKey = null;
          onHoverVertexRef.current && onHoverVertexRef.current(null);
        }
        s.target.x = x;
        s.target.y = y;
        s.mode = "follow";
      }
    },
    [pickNearestValidPeg]
  );

  const finishStretch = useCallback(() => {
    const st = stretchRef.current;
    if (!st.active) return;
    st.active = false;
    const releasedStart = st.startKey;
    const releasedTarget = st.targetKey;
    const s = springRef.current;
    if (!releasedTarget) {
      s.target.x = s.anchor.x;
      s.target.y = s.anchor.y;
      onRetractRef.current && onRetractRef.current();
      hapticLight();
    } else {
      hapticSuccess();
    }
    s.mode = "release";
    onHoverVertexRef.current && onHoverVertexRef.current(null);
    onDragEndRef.current && onDragEndRef.current(releasedStart, releasedTarget);
  }, []);

  // Deliberately kept on the JS thread (not a UI-thread worklet) --
  // simpler and lower-risk than routing our plain-JS game-logic helpers
  // (Maps/Sets from board/logic.js) through Reanimated's worklet
  // compiler, and this execution model never caused problems for us.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin((e) => {
          if (!canInteractRef.current) return;
          const key = pickAnyPeg(e.x, e.y);
          if (key) beginStretch(key);
        })
        .onUpdate((e) => {
          if (stretchRef.current.active) updateStretch(e.x, e.y);
        })
        .onEnd(() => {
          if (stretchRef.current.active) finishStretch();
        })
        .onFinalize(() => {
          if (stretchRef.current.active) finishStretch();
        }),
    [pickAnyPeg, beginStretch, updateStretch, finishStretch]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={onLayout}
        style={{
          width: "100%",
          aspectRatio: 1,
          maxHeight: 560,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: "#140d09",
        }}
      >
        <Canvas style={{ flex: 1 }}>
          <Path path={trayPathA} color={WOOD_COLOR} />
          <Path path={trayPathB} color={WOOD_COLOR} />

          {board.faces.map((f, i) => {
            const owner = game.faceOwners[f.id];
            const color = owner == null ? WOOD_COLOR : game.players[owner].color;
            return <Path key={f.id} path={facePaths[i]} color={color} />;
          })}

          {bandPaths.map((b) => (
            <Path key={b.id} path={b.path} color={b.color} style="stroke" strokeWidth={BAND_WIDTH} strokeCap="round" />
          ))}

          {dragBand && (
            <Path
              path={makeLinePath(dragBand.x1, dragBand.y1, dragBand.x2, dragBand.y2)}
              color={dragBand.color}
              style="stroke"
              strokeWidth={DRAG_BAND_WIDTH}
              strokeCap="round"
            />
          )}

          {Array.from(board.vertices.keys()).map((key) => {
            const p = vertexScreen.get(key);
            const isStart = selectedStart === key;
            const isValid = validTargets && validTargets.has(key);
            const isHover = hoverVertex === key;
            let fill = BRASS_COLOR;
            let r = PEG_R;
            if (isStart) {
              fill = bandColor;
              r = PEG_R * 1.4;
            } else if (isValid) {
              fill = bandColor;
              r = isHover ? PEG_R * 1.4 : PEG_R * 1.15;
            } else if (selectedStart) {
              fill = DIM_COLOR;
            } else if (isHover) {
              r = PEG_R * 1.15;
            }
            return <Circle key={key} cx={p.x} cy={p.y} r={r} color={fill} />;
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
