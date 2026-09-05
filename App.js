import React, { useState, useMemo, useEffect, useCallback } from "react";
import { View, StatusBar, Pressable, Text, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { buildBoard, initGame, tryMove, computeAIMove, computeValidTargets } from "./src/game/logic";
import { useSynth } from "./src/hooks/useSynth";
import { COLORS, PALETTE } from "./src/theme";
import SetupScreen from "./src/screens/SetupScreen";
import GameScreen from "./src/screens/GameScreen";
import GuideModal from "./src/components/GuideModal";

function Toolbar({ soundOn, setSoundOn, onShowGuide }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.toolbar, { top: insets.top + 8, right: 12 }]}>
      <Pressable onPress={() => setSoundOn((s) => !s)} style={styles.iconBtn}>
        <Text style={styles.iconText}>{soundOn ? "\u{1F50A}" : "\u{1F507}"}</Text>
      </Pressable>
      <Pressable onPress={onShowGuide} style={styles.iconBtn}>
        <Text style={[styles.iconText, { color: COLORS.gold, fontWeight: "700" }]}>?</Text>
      </Pressable>
    </View>
  );
}

function Root() {
  const [phase, setPhase] = useState("setup"); // 'setup' | 'playing'
  const [sizeN, setSizeN] = useState(3);
  const [playerCount, setPlayerCount] = useState(2);
  const [vsAI, setVsAI] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const [board, setBoard] = useState(null);
  const [game, setGame] = useState(null);
  const [selectedStart, setSelectedStart] = useState(null);
  const [hoverVertex, setHoverVertex] = useState(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [sessionId, setSessionId] = useState(0); // forces Board3D to remount per game

  const { tick, commit, retract, claim } = useSynth(soundOn);

  const startGame = useCallback(() => {
    const b = buildBoard(sizeN);
    const players = Array.from({ length: playerCount }).map((_, idx) => ({
      name: vsAI && idx === 1 ? "AI" : `Player ${idx + 1}`,
      color: PALETTE[idx].color,
      dim: PALETTE[idx].dim,
      type: vsAI && idx === 1 ? "ai" : "human",
    }));
    setBoard(b);
    setGame(initGame(players));
    setSelectedStart(null);
    setHoverVertex(null);
    setHasMoved(false);
    setSessionId((id) => id + 1);
    setPhase("playing");
  }, [sizeN, playerCount, vsAI]);

  const backToSetup = useCallback(() => {
    setPhase("setup");
    setBoard(null);
    setGame(null);
  }, []);

  const applyMove = useCallback(
    (v1, v2) => {
      const result = tryMove(board, game, v1, v2);
      if (!result) return false;
      setGame(result);
      setHasMoved(true);
      if (result.lastClaimed.length > 0) claim();
      else commit();
      return true;
    },
    [board, game, claim, commit]
  );

  // AI turn
  useEffect(() => {
    if (phase !== "playing" || !game || !board || game.gameOver) return;
    const cur = game.players[game.currentPlayer];
    if (cur.type !== "ai") return;
    const t = setTimeout(() => {
      const move = computeAIMove(board, game);
      if (move) applyMove(move.a, move.b);
    }, 650);
    return () => clearTimeout(t);
  }, [phase, game, board, applyMove]);

  const canInteract = !!(board && game && !game.gameOver && game.players[game.currentPlayer].type === "human");

  const handleDragStart = useCallback(
    (key) => {
      if (!canInteract) return;
      setSelectedStart(key);
    },
    [canInteract]
  );

  const handleDragEnd = useCallback(
    (startKey, targetKey) => {
      if (targetKey && startKey) applyMove(startKey, targetKey);
      else retract();
      setSelectedStart(null);
      setHoverVertex(null);
    },
    [applyMove, retract]
  );

  const validTargets = useMemo(() => {
    if (!board || !game || !selectedStart) return null;
    if (game.players[game.currentPlayer].type === "ai") return null;
    return computeValidTargets(board, game.edges, selectedStart);
  }, [board, game, selectedStart]);

  const winnerInfo = useMemo(() => {
    if (!game || !game.gameOver) return null;
    const max = Math.max(...game.scores);
    const winners = game.players.filter((_, i) => game.scores[i] === max);
    return { max, winners, tie: winners.length > 1 };
  }, [game]);

  return (
    <View style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg0} />
      <Toolbar soundOn={soundOn} setSoundOn={setSoundOn} onShowGuide={() => setShowGuide(true)} />

      {phase === "setup" && (
        <SetupScreen
          sizeN={sizeN}
          setSizeN={setSizeN}
          playerCount={playerCount}
          setPlayerCount={setPlayerCount}
          vsAI={vsAI}
          setVsAI={setVsAI}
          onStart={startGame}
          onShowGuide={() => setShowGuide(true)}
        />
      )}

      {phase === "playing" && board && game && (
        <GameScreen
          board={board}
          game={game}
          selectedStart={selectedStart}
          hoverVertex={hoverVertex}
          setHoverVertex={setHoverVertex}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onSnapTick={tick}
          onRetract={retract}
          canInteract={canInteract}
          validTargets={validTargets}
          winnerInfo={winnerInfo}
          onNewGame={backToSetup}
          onRematch={startGame}
          showTip={!hasMoved}
          onDismissTip={() => setHasMoved(true)}
          sessionId={sessionId}
        />
      )}

      <GuideModal visible={showGuide} onClose={() => setShowGuide(false)} />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Root />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLORS.bg0 },
  toolbar: { position: "absolute", flexDirection: "row", gap: 8, zIndex: 10 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(233,201,138,0.25)",
  },
  iconText: { fontSize: 17, color: COLORS.text },
});
