import { GLView } from "expo-gl";
import * as Haptics from "expo-haptics";
import { Renderer } from "expo-three";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as THREE from "three";
import { useLatestRef } from "../hooks/useLatestRef";

const PEG_Y = 0.16;
const DIM_COLOR = 0x362c1e;
const WOOD_COLOR = 0x241a12;
const BRASS_COLOR = 0xc9a35c;

// Orients a unit cylinder (default axis +Y) to run between two points that
// share the same Y (bands and pegs are all on a flat plane), so a plain
// shortest-arc rotation from +Y to the direction vector is safe.
function orientCylinder(mesh, p1, p2) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length() || 0.0001;
  mesh.position.copy(p1).addScaledVector(dir, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
}

const hapticLight = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
const hapticSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
};

export default function Board3D({
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
  // ---- refs that must survive re-renders without triggering them ----
  const sceneStateRef = useRef(null); // populated once GL context is created
  const layoutRef = useRef({ width: 1, height: 1 });
  const orbitRef = useRef({ radius: 6, polar: 0.6, azimuth: 0.45 });
  const springRef = useRef({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    target: new THREE.Vector3(),
    anchor: new THREE.Vector3(),
    mode: "follow",
    hideAt: 0,
  });
  const gestureModeRef = useRef(null); // null | 'orbit' | 'stretch'
  const stretchRef = useRef({
    startKey: null,
    targetKey: null,
    finished: true,
  });
  const prevTranslationRef = useRef({ x: 0, y: 0 });
  const orbitDraggingRef = useRef(false);
  const pinchStartRadiusRef = useRef(6);

  const onDragStartRef = useLatestRef(onDragStart);
  const onDragEndRef = useLatestRef(onDragEnd);
  const onHoverVertexRef = useLatestRef(onHoverVertex);
  const onSnapTickRef = useLatestRef(onSnapTick);
  const onRetractRef = useLatestRef(onRetract);
  const validTargetsRef = useLatestRef(validTargets);
  const canInteractRef = useLatestRef(canInteract);
  const bandColorRef = useLatestRef(bandColor);
  const boardRef = useLatestRef(board);

  // ---- helpers that read the live scene/refs (not captured props) ----
  const ndcOf = useCallback((x, y) => {
    const { width, height } = layoutRef.current;
    return { x: (x / width) * 2 - 1, y: -(y / height) * 2 + 1 };
  }, []);

  const pickAny = useCallback(
    (x, y) => {
      const s = sceneStateRef.current;
      if (!s) return null;
      s.raycaster.setFromCamera(ndcOf(x, y), s.camera);
      const hits = s.raycaster.intersectObjects(s.hitMeshes);
      return hits.length > 0 ? hits[0].object.userData.vertexKey : null;
    },
    [ndcOf],
  );

  const updateCameraNow = useCallback(() => {
    const s = sceneStateRef.current;
    if (!s) return;
    const o = orbitRef.current;
    s.camera.position.set(
      o.radius * Math.sin(o.polar) * Math.sin(o.azimuth),
      o.radius * Math.cos(o.polar),
      o.radius * Math.sin(o.polar) * Math.cos(o.azimuth),
    );
    s.camera.lookAt(0, 0, 0);
  }, []);

  const clampRadius = useCallback((r) => {
    const s = sceneStateRef.current;
    if (!s) return r;
    return Math.min(s.maxRadius, Math.max(s.minRadius, r));
  }, []);

  const beginStretch = useCallback(
    (key) => {
      const s = sceneStateRef.current;
      if (!s) return;
      const spring = springRef.current;
      stretchRef.current = { startKey: key, targetKey: null, finished: false };
      const p0 = s.pegMeshes.get(key).position;
      spring.anchor.copy(p0);
      spring.pos.copy(p0);
      spring.vel.set(0, 0, 0);
      spring.target.copy(p0);
      spring.mode = "follow";
      s.dragMat.color.set(bandColorRef.current || "#e9c98a");
      s.dragMat.opacity = 0.9;
      s.dragMesh.visible = true;
      onDragStartRef.current && onDragStartRef.current(key);
    },
    [bandColorRef, onDragStartRef],
  );

  const updateStretch = useCallback(
    (x, y) => {
      const s = sceneStateRef.current;
      if (!s) return;
      const spring = springRef.current;
      const st = stretchRef.current;
      s.raycaster.setFromCamera(ndcOf(x, y), s.camera);
      const valid = validTargetsRef.current;
      const candidates = valid
        ? s.hitMeshes.filter((m) => valid.has(m.userData.vertexKey))
        : [];
      const hits = candidates.length
        ? s.raycaster.intersectObjects(candidates)
        : [];
      if (hits.length > 0) {
        const key = hits[0].object.userData.vertexKey;
        if (key !== st.targetKey) {
          st.targetKey = key;
          onHoverVertexRef.current && onHoverVertexRef.current(key);
          onSnapTickRef.current && onSnapTickRef.current();
          hapticLight();
        }
        spring.target.copy(s.pegMeshes.get(key).position);
        spring.mode = "snap";
      } else {
        if (st.targetKey !== null) {
          st.targetKey = null;
          onHoverVertexRef.current && onHoverVertexRef.current(null);
        }
        const groundHit = new THREE.Vector3();
        if (s.raycaster.ray.intersectPlane(s.groundPlane, groundHit)) {
          groundHit.y = PEG_Y;
          spring.target.copy(groundHit);
        }
        spring.mode = "follow";
      }
    },
    [ndcOf, validTargetsRef, onHoverVertexRef, onSnapTickRef],
  );

  const finishStretch = useCallback(() => {
    const st = stretchRef.current;
    if (st.finished) return;
    st.finished = true;
    const spring = springRef.current;
    const releasedTarget = st.targetKey;
    const releasedStart = st.startKey;
    if (!releasedTarget) {
      spring.target.copy(spring.anchor);
      onRetractRef.current && onRetractRef.current();
      hapticLight();
    } else {
      hapticSuccess();
    }
    spring.mode = "release";
    spring.hideAt = Date.now() + 320;
    stretchRef.current = { startKey: null, targetKey: null, finished: true };
    onHoverVertexRef.current && onHoverVertexRef.current(null);
    onDragEndRef.current && onDragEndRef.current(releasedStart, releasedTarget);
  }, [onRetractRef, onHoverVertexRef, onDragEndRef]);

  // ---- gestures: press a peg to stretch, press empty space to orbit,
  //      two fingers to pinch-zoom (independent of the pan gesture) ----
  const composedGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .onBegin((e) => {
        prevTranslationRef.current = { x: 0, y: 0 };
        const key = canInteractRef.current ? pickAny(e.x, e.y) : null;
        if (key) {
          gestureModeRef.current = "stretch";
          beginStretch(key);
        } else {
          gestureModeRef.current = "orbit";
          orbitDraggingRef.current = false;
        }
      })
      .onUpdate((e) => {
        const prev = prevTranslationRef.current;
        const dx = e.translationX - prev.x;
        const dy = e.translationY - prev.y;
        prevTranslationRef.current = { x: e.translationX, y: e.translationY };

        if (gestureModeRef.current === "stretch") {
          updateStretch(e.x, e.y);
        } else if (gestureModeRef.current === "orbit") {
          const total = Math.hypot(e.translationX, e.translationY);
          if (total > 6) orbitDraggingRef.current = true;
          if (orbitDraggingRef.current) {
            const o = orbitRef.current;
            o.azimuth -= dx * 0.008;
            o.polar = Math.min(1.35, Math.max(0.22, o.polar - dy * 0.008));
            updateCameraNow();
          }
        }
      })
      .onEnd(() => {
        if (gestureModeRef.current === "stretch") finishStretch();
        gestureModeRef.current = null;
        orbitDraggingRef.current = false;
      })
      .onFinalize((_e, success) => {
        if (!success && gestureModeRef.current === "stretch") finishStretch();
        gestureModeRef.current = null;
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        pinchStartRadiusRef.current = orbitRef.current.radius;
      })
      .onUpdate((e) => {
        orbitRef.current.radius = clampRadius(
          pinchStartRadiusRef.current / e.scale,
        );
        updateCameraNow();
      });

    return Gesture.Simultaneous(pan, pinch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pickAny,
    beginStretch,
    updateStretch,
    finishStretch,
    updateCameraNow,
    clampRadius,
  ]);

  // ---- GL context: build the static scene once per board ----
  const onContextCreate = useCallback(
    (gl) => {
      const board = boardRef.current;
      if (!board) return;

      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        42,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        100,
      );

      scene.add(new THREE.AmbientLight(0xfff2df, 0.7));
      const keyLight = new THREE.DirectionalLight(0xfff2df, 0.85);
      keyLight.position.set(6, 10, 5);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x88aaff, 0.22);
      fillLight.position.set(-6, 5, -4);
      scene.add(fillLight);

      // board surface: every small triangle tiles the hexagram exactly
      const faceMeshes = new Map();
      board.faces.forEach((f) => {
        const pts = f.verts.map((k) => board.vertices.get(k));
        const positions = new Float32Array([
          pts[0].x,
          0,
          pts[0].y,
          pts[1].x,
          0,
          pts[1].y,
          pts[2].x,
          0,
          pts[2].y,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        const nrm = geo.getAttribute("normal");
        if (nrm.getY(0) < 0) {
          const p = geo.getAttribute("position");
          const tx = p.getX(1),
            ty = p.getY(1),
            tz = p.getZ(1);
          p.setXYZ(1, p.getX(2), p.getY(2), p.getZ(2));
          p.setXYZ(2, tx, ty, tz);
          p.needsUpdate = true;
          geo.computeVertexNormals();
        }
        const mat = new THREE.MeshStandardMaterial({
          color: WOOD_COLOR,
          roughness: 0.92,
          metalness: 0.04,
        });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        faceMeshes.set(f.id, mesh);
      });

      // pegs + generous invisible hit targets
      const pegGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.16, 14);
      const hitGeo = new THREE.SphereGeometry(0.26, 8, 8);
      const pegMeshes = new Map();
      const hitMeshes = [];
      board.vertices.forEach((v) => {
        const mat = new THREE.MeshStandardMaterial({
          color: BRASS_COLOR,
          roughness: 0.45,
          metalness: 0.35,
        });
        const mesh = new THREE.Mesh(pegGeo, mat);
        mesh.position.set(v.x, PEG_Y / 2, v.y);
        scene.add(mesh);
        pegMeshes.set(v.key, mesh);

        const hitMat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.set(v.x, PEG_Y, v.y);
        hit.userData.vertexKey = v.key;
        scene.add(hit);
        hitMeshes.push(hit);
      });

      const bandGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 8);

      const dragMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: 0.9,
      });
      const dragBandGeo = new THREE.CylinderGeometry(0.038, 0.038, 1, 8);
      const dragMesh = new THREE.Mesh(dragBandGeo, dragMat);
      dragMesh.visible = false;
      scene.add(dragMesh);

      const vb = board.viewBox;
      const spanDiag = Math.hypot(vb.w, vb.h);
      orbitRef.current = { radius: spanDiag * 0.72, polar: 0.6, azimuth: 0.45 };

      sceneStateRef.current = {
        scene,
        camera,
        renderer,
        gl,
        faceMeshes,
        pegMeshes,
        hitMeshes,
        bandGeo,
        bandMeshes: [],
        dragMesh,
        dragMat,
        raycaster: new THREE.Raycaster(),
        groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -PEG_Y),
        minRadius: spanDiag * 0.32,
        maxRadius: spanDiag * 1.7,
      };

      updateCameraNow();

      let raf;
      let t = 0;
      let last = Date.now();
      const animate = () => {
        raf = requestAnimationFrame(animate);
        const s = sceneStateRef.current;
        if (!s) return;
        const now = Date.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;

        s.pegMeshes.forEach((mesh) => {
          if (mesh.userData.pulsing) {
            mesh.material.emissiveIntensity = 0.35 + 0.35 * Math.sin(t * 4.2);
          }
        });
        s.faceMeshes.forEach((mesh) => {
          const until = mesh.userData.popUntil;
          if (until) {
            const remain = Math.max(0, until - Date.now());
            if (remain <= 0) {
              mesh.scale.set(1, 1, 1);
              mesh.userData.popUntil = null;
            } else {
              const k = 1 - remain / 400;
              const bounce =
                1 + 0.22 * Math.sin(Math.min(1, k * 1.6) * Math.PI) * (1 - k);
              mesh.scale.set(bounce, 1, bounce);
            }
          }
        });

        const spring = springRef.current;
        if (s.dragMesh.visible) {
          const releasing = spring.mode === "release";
          const stiffness = releasing
            ? 170
            : spring.mode === "snap"
              ? 320
              : 260;
          const damping = releasing ? 9 : spring.mode === "snap" ? 16 : 22;
          const ax =
            (spring.target.x - spring.pos.x) * stiffness -
            spring.vel.x * damping;
          const ay =
            (spring.target.y - spring.pos.y) * stiffness -
            spring.vel.y * damping;
          const az =
            (spring.target.z - spring.pos.z) * stiffness -
            spring.vel.z * damping;
          spring.vel.x += ax * dt;
          spring.vel.y += ay * dt;
          spring.vel.z += az * dt;
          spring.pos.x += spring.vel.x * dt;
          spring.pos.y += spring.vel.y * dt;
          spring.pos.z += spring.vel.z * dt;

          if (spring.anchor.distanceToSquared(spring.pos) > 0.0004) {
            orientCylinder(s.dragMesh, spring.anchor, spring.pos);
          } else {
            s.dragMesh.visible = false;
          }
          if (releasing) {
            s.dragMat.opacity = Math.max(0.25, s.dragMat.opacity - dt * 1.4);
            if (Date.now() > spring.hideAt) s.dragMesh.visible = false;
          }
        }

        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();

      // stash the raf id on the scene state so layout/unmount can cancel it
      sceneStateRef.current.raf = raf;
    },
    [boardRef, updateCameraNow],
  );

  const onLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    layoutRef.current = { width, height };
    const s = sceneStateRef.current;
    if (s) {
      s.camera.aspect = width / height;
      s.camera.updateProjectionMatrix();
    }
  }, []);

  // Cancel the render loop and free GL resources when this board unmounts
  // (e.g. leaving the game screen, or a parent-driven remount for a new game
  // -- see the `key` prop note in GameScreen).
  useEffect(() => {
    return () => {
      const s = sceneStateRef.current;
      if (!s) return;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.faceMeshes.forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      s.bandMeshes.forEach((m) => m.material.dispose());
      s.pegMeshes.forEach((m) => m.material.dispose());
      s.hitMeshes.forEach((m) => m.material.dispose());
      s.bandGeo.dispose();
      s.dragMat.dispose();
      s.dragMesh.geometry.dispose();
      sceneStateRef.current = null;
    };
  }, []);

  // ---- apply dynamic game state to the live scene whenever it changes ----
  // (cheap: just color/scale/position writes on already-created meshes)
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s || !board || !game) return;

    board.faces.forEach((f) => {
      const mesh = s.faceMeshes.get(f.id);
      if (!mesh) return;
      const owner = game.faceOwners[f.id];
      if (owner == null) mesh.material.color.setHex(WOOD_COLOR);
      else mesh.material.color.set(game.players[owner].color);
    });
    if (game.lastClaimed && game.lastClaimed.length) {
      game.lastClaimed.forEach((fid) => {
        const mesh = s.faceMeshes.get(fid);
        if (mesh) mesh.userData.popUntil = Date.now() + 400;
      });
    }
    while (s.bandMeshes.length < game.bands.length) {
      const b = game.bands[s.bandMeshes.length];
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(b.color),
        roughness: 0.4,
        metalness: 0.12,
      });
      const mesh = new THREE.Mesh(s.bandGeo, mat);
      orientCylinder(
        mesh,
        new THREE.Vector3(b.x1, PEG_Y, b.y1),
        new THREE.Vector3(b.x2, PEG_Y, b.y2),
      );
      s.scene.add(mesh);
      s.bandMeshes.push(mesh);
    }
    const activeColor = game.players[game.currentPlayer].color;
    s.pegMeshes.forEach((mesh, key) => {
      mesh.userData.pulsing = false;
      const isStart = selectedStart === key;
      const isValid = validTargets && validTargets.has(key);
      const isHover = hoverVertex === key;
      if (isStart) {
        mesh.material.color.set(activeColor);
        mesh.material.emissive.set(activeColor);
        mesh.material.emissiveIntensity = 0.6;
        mesh.scale.setScalar(1.35);
      } else if (isValid) {
        mesh.material.color.set(activeColor);
        mesh.material.emissive.set(activeColor);
        mesh.userData.pulsing = true;
        mesh.scale.setScalar(isHover ? 1.4 : 1.15);
      } else if (selectedStart) {
        mesh.material.color.setHex(DIM_COLOR);
        mesh.material.emissive.setHex(0x000000);
        mesh.material.emissiveIntensity = 0;
        mesh.scale.setScalar(1);
      } else {
        mesh.material.color.setHex(BRASS_COLOR);
        mesh.material.emissive.setHex(isHover ? 0x4a3a1c : 0x000000);
        mesh.material.emissiveIntensity = isHover ? 0.5 : 0;
        mesh.scale.setScalar(isHover ? 1.18 : 1);
      }
    });
    // sceneStateRef.current is populated imperatively by onContextCreate
    // (which fires once, asynchronously, after mount) rather than through
    // React state, so this effect re-reads it fresh on every dependency
    // change instead of taking it as a dependency itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, game, selectedStart, validTargets, hoverVertex]);

  return (
    <GestureDetector gesture={composedGesture}>
      <View
        onLayout={onLayout}
        style={{
          width: "100%",
          aspectRatio: 1,
          maxHeight: 560,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
      </View>
    </GestureDetector>
  );
}
