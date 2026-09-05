// Pure game logic -- identical to the web prototype. Nothing here touches
// the DOM or any platform API, so it's a straight copy-paste into React
// Native with zero changes.

const SQ3_2 = 0.8660254037844386;

function transform(i, j, cx, cy) {
  return { x: i + 0.5 * j - cx, y: j * SQ3_2 - cy };
}

export function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildBoard(n) {
  const N = 3 * n;
  const inA = (i, j) => i >= 0 && j >= 0 && i + j <= N;
  const inB = (i, j) => i <= 2 * n && j <= 2 * n && i + j >= n;
  const inH = (i, j) => inA(i, j) || inB(i, j);

  const cx = 1.5 * n;
  const cy = n * SQ3_2;

  const vertices = new Map();
  for (let i = -n; i <= N; i++) {
    for (let j = -n; j <= N; j++) {
      if (inH(i, j)) {
        const { x, y } = transform(i, j, cx, cy);
        vertices.set(`${i},${j}`, { key: `${i},${j}`, i, j, x, y });
      }
    }
  }

  const faces = [];
  let fid = 0;
  for (let i = -n; i <= N; i++) {
    for (let j = -n; j <= N; j++) {
      const tris = [
        [[i, j], [i + 1, j], [i, j + 1]],
        [[i + 1, j], [i + 1, j + 1], [i, j + 1]],
      ];
      for (const tri of tris) {
        const keys = tri.map(([a, b]) => `${a},${b}`);
        if (keys.every((k) => vertices.has(k))) {
          const edges = [
            edgeKey(keys[0], keys[1]),
            edgeKey(keys[1], keys[2]),
            edgeKey(keys[0], keys[2]),
          ];
          const pts = keys.map((k) => vertices.get(k));
          const cxp = (pts[0].x + pts[1].x + pts[2].x) / 3;
          const cyp = (pts[0].y + pts[1].y + pts[2].y) / 3;
          faces.push({ id: fid++, verts: keys, edges, cx: cxp, cy: cyp });
        }
      }
    }
  }

  const edgeFaces = new Map();
  faces.forEach((f) => {
    f.edges.forEach((e) => {
      if (!edgeFaces.has(e)) edgeFaces.set(e, []);
      edgeFaces.get(e).push(f.id);
    });
  });

  const cornersA = [[0, 0], [N, 0], [0, N]].map(([i, j]) => transform(i, j, cx, cy));
  const cornersB = [[2 * n, 2 * n], [2 * n, -n], [-n, 2 * n]].map(([i, j]) =>
    transform(i, j, cx, cy)
  );

  const allPts = [...cornersA, ...cornersB];
  const minX = Math.min(...allPts.map((p) => p.x));
  const maxX = Math.max(...allPts.map((p) => p.x));
  const minY = Math.min(...allPts.map((p) => p.y));
  const maxY = Math.max(...allPts.map((p) => p.y));

  return {
    n,
    vertices,
    faces,
    edgeFaces,
    cornersA,
    cornersB,
    viewBox: { minX: minX - 1, minY: minY - 1, w: maxX - minX + 2, h: maxY - minY + 2 },
  };
}

export function parseKey(k) {
  const [i, j] = k.split(",").map(Number);
  return { i, j };
}

export function getPath(v1, v2) {
  const { i: i1, j: j1 } = parseKey(v1);
  const { i: i2, j: j2 } = parseKey(v2);
  const di = i2 - i1;
  const dj = j2 - j1;
  if (di === 0 && dj === 0) return null;
  let stepI, stepJ, steps;
  if (dj === 0) {
    stepI = Math.sign(di);
    stepJ = 0;
    steps = Math.abs(di);
  } else if (di === 0) {
    stepI = 0;
    stepJ = Math.sign(dj);
    steps = Math.abs(dj);
  } else if (di === -dj) {
    stepI = Math.sign(di);
    stepJ = -stepI;
    steps = Math.abs(di);
  } else {
    return null;
  }
  const path = [];
  for (let s = 0; s <= steps; s++) path.push(`${i1 + stepI * s},${j1 + stepJ * s}`);
  return path;
}

const RAY_DIRS = [
  { di: 1, dj: 0 },
  { di: -1, dj: 0 },
  { di: 0, dj: 1 },
  { di: 0, dj: -1 },
  { di: 1, dj: -1 },
  { di: -1, dj: 1 },
];

export function computeValidTargets(board, edges, startKey) {
  const { i: i0, j: j0 } = parseKey(startKey);
  const result = new Set();
  for (const d of RAY_DIRS) {
    let i = i0,
      j = j0;
    let prevKey = startKey;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const ni = i + d.di,
        nj = j + d.dj;
      const nk = `${ni},${nj}`;
      if (!board.vertices.has(nk)) break;
      const ek = edgeKey(prevKey, nk);
      if (edges.has(ek)) break;
      result.add(nk);
      prevKey = nk;
      i = ni;
      j = nj;
    }
  }
  return result;
}

export function initGame(players) {
  return {
    edges: new Set(),
    faceOwners: [],
    scores: players.map(() => 0),
    bands: [],
    players,
    currentPlayer: 0,
    bonus: false,
    gameOver: false,
    lastClaimed: [],
    lastMoveId: -1,
  };
}

export function tryMove(board, game, v1, v2) {
  if (v1 === v2) return null;
  const path = getPath(v1, v2);
  if (!path) return null;
  for (const k of path) if (!board.vertices.has(k)) return null;

  const edgesToAdd = [];
  for (let s = 0; s < path.length - 1; s++) {
    const ek = edgeKey(path[s], path[s + 1]);
    if (game.edges.has(ek)) return null;
    edgesToAdd.push(ek);
  }

  const newEdges = new Set(game.edges);
  edgesToAdd.forEach((e) => newEdges.add(e));

  const faceIdsToCheck = new Set();
  edgesToAdd.forEach((e) => {
    const fids = board.edgeFaces.get(e);
    if (fids) fids.forEach((fid) => faceIdsToCheck.add(fid));
  });

  const owners = game.faceOwners.slice();
  const claimed = [];
  faceIdsToCheck.forEach((fid) => {
    if (owners[fid] != null) return;
    const face = board.faces[fid];
    if (face.edges.every((e) => newEdges.has(e))) {
      owners[fid] = game.currentPlayer;
      claimed.push(fid);
    }
  });

  const scores = game.scores.slice();
  if (claimed.length > 0) scores[game.currentPlayer] += claimed.length;

  const vs1 = board.vertices.get(v1);
  const vs2 = board.vertices.get(v2);
  const bands = [
    ...game.bands,
    {
      id: game.bands.length,
      x1: vs1.x,
      y1: vs1.y,
      x2: vs2.x,
      y2: vs2.y,
      color: game.players[game.currentPlayer].color,
    },
  ];

  const claimedCount = owners.filter((o) => o != null).length;
  const gameOver = claimedCount === board.faces.length;

  let nextPlayer = game.currentPlayer;
  let bonus = false;
  if (!gameOver) {
    if (claimed.length === 0) {
      nextPlayer = (game.currentPlayer + 1) % game.players.length;
    } else {
      bonus = true;
    }
  }

  return {
    ...game,
    edges: newEdges,
    faceOwners: owners,
    scores,
    bands,
    currentPlayer: nextPlayer,
    bonus,
    gameOver,
    lastClaimed: claimed,
    lastMoveId: bands.length - 1,
  };
}

export function computeAIMove(board, game) {
  const candidates = [];
  board.edgeFaces.forEach((_fids, ek) => {
    if (!game.edges.has(ek)) {
      const [a, b] = ek.split("|");
      candidates.push({ a, b });
    }
  });
  if (candidates.length === 0) return null;

  let best = [];
  let bestScore = -1;
  for (const c of candidates) {
    const r = tryMove(board, game, c.a, c.b);
    const score = r ? r.lastClaimed.length : -1;
    if (score > bestScore) {
      bestScore = score;
      best = [c];
    } else if (score === bestScore) {
      best.push(c);
    }
  }
  if (bestScore > 0) return best[Math.floor(Math.random() * best.length)];

  const safe = candidates.filter((c) => {
    const r = tryMove(board, game, c.a, c.b);
    if (!r) return false;
    for (const f of board.faces) {
      if (r.faceOwners[f.id] != null) continue;
      const drawn = f.edges.filter((e) => r.edges.has(e)).length;
      if (drawn === 2) return false;
    }
    return true;
  });
  const pool = safe.length > 0 ? safe : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}
