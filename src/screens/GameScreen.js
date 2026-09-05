import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Board3D from "../components/Board3D";
import { COLORS } from "../theme";

export default function GameScreen({
  board,
  game,
  selectedStart,
  hoverVertex,
  setHoverVertex,
  onDragStart,
  onDragEnd,
  onSnapTick,
  onRetract,
  canInteract,
  validTargets,
  winnerInfo,
  onNewGame,
  onRematch,
  showTip,
  onDismissTip,
  sessionId,
}) {
  const insets = useSafeAreaInsets();
  const claimedCount = game.faceOwners.filter((o) => o != null).length;
  const totalFaces = board.faces.length;
  const progressPct = Math.round((claimedCount / totalFaces) * 100);
  const activeColor = game.players[game.currentPlayer].color;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.wordmark}>Triangle Chain</Text>

      <View style={styles.chipsRow}>
        {game.players.map((p, idx) => (
          <View
            key={idx}
            style={[
              styles.chip,
              {
                borderColor: idx === game.currentPlayer ? p.color : "rgba(255,255,255,0.12)",
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={styles.chipName}>
              {p.name}
              {p.type === "ai" ? " \u{1F916}" : ""}
            </Text>
            <Text style={[styles.chipScore, { color: p.color }]}>{game.scores[idx]}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.status}>
        {game.gameOver
          ? "Board complete!"
          : game.bonus
          ? `${game.players[game.currentPlayer].name} completed a triangle \u2014 bonus turn!`
          : `${game.players[game.currentPlayer].name}'s turn${
              game.players[game.currentPlayer].type === "ai"
                ? " (thinking\u2026)"
                : selectedStart
                ? " \u2014 drag to a glowing peg"
                : " \u2014 press and drag a peg"
            }`}
      </Text>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: activeColor }]} />
        </View>
        <Text style={styles.progressText}>
          {claimedCount}/{totalFaces}
        </Text>
      </View>

      {showTip && !game.gameOver && (
        <View style={styles.tip}>
          <Text style={styles.tipText}>
            Press a peg and drag like a real rubber band &mdash; release on a glowing peg to hook
            it, or let go anywhere else to snap back.
          </Text>
          <Pressable onPress={onDismissTip} hitSlop={8}>
            <Text style={styles.tipClose}>\u2715</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.boardWrap, { borderColor: activeColor + "55" }]}>
        <Board3D
          key={sessionId}
          board={board}
          game={game}
          selectedStart={selectedStart}
          validTargets={validTargets}
          hoverVertex={hoverVertex}
          canInteract={canInteract}
          bandColor={activeColor}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onSnapTick={onSnapTick}
          onRetract={onRetract}
          onHoverVertex={setHoverVertex}
        />
        <Text style={styles.hint}>Drag a peg to stretch &middot; Drag empty space to rotate &middot; Pinch to zoom</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={onNewGame} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Change Setup</Text>
        </Pressable>
        {game.gameOver && (
          <Pressable onPress={onRematch} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Rematch</Text>
          </Pressable>
        )}
      </View>

      {winnerInfo && (
        <View style={[styles.winnerCard, { marginBottom: insets.bottom + 16 }]}>
          {winnerInfo.tie ? (
            <Text style={styles.winnerTitle}>It's a tie at {winnerInfo.max} triangles each!</Text>
          ) : (
            <Text style={[styles.winnerTitle, { color: winnerInfo.winners[0].color }]}>
              {"\u{1F3C6}"} {winnerInfo.winners[0].name} wins with {winnerInfo.max} triangles!
            </Text>
          )}
          {game.players.map((p, idx) => {
            const pct = Math.round((game.scores[idx] / totalFaces) * 100);
            return (
              <View key={idx} style={styles.scoreRow}>
                <Text style={styles.scoreName}>{p.name}</Text>
                <View style={styles.scoreTrack}>
                  <View style={[styles.scoreFill, { width: `${pct}%`, backgroundColor: p.color }]} />
                </View>
                <Text style={[styles.scoreVal, { color: p.color }]}>{game.scores[idx]}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14, alignItems: "center" },
  wordmark: { color: COLORS.gold, fontSize: 18, fontWeight: "700", marginBottom: 10 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
  },
  dot: { width: 11, height: 11, borderRadius: 6 },
  chipName: { color: COLORS.text, fontSize: 13, fontWeight: "500" },
  chipScore: { fontSize: 13, fontWeight: "700" },
  status: { color: COLORS.gold, fontSize: 13, textAlign: "center", marginBottom: 6, minHeight: 18 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", maxWidth: 380, marginBottom: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { color: COLORS.textDim, fontSize: 11 },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
    maxWidth: 380,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(233,201,138,0.1)",
    borderWidth: 1,
    borderColor: "rgba(233,201,138,0.3)",
    marginBottom: 10,
  },
  tipText: { flex: 1, color: "#e6dac3", fontSize: 12, lineHeight: 17 },
  tipClose: { color: COLORS.goldDim, fontSize: 13 },
  boardWrap: {
    width: "100%",
    borderRadius: 16,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1.5,
  },
  hint: { color: COLORS.textDim, fontSize: 10, textAlign: "center", marginTop: 6 },
  actionsRow: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 380, marginTop: 14 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: "500", fontSize: 14 },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#3ecf8e",
  },
  primaryBtnText: { color: "#0b2117", fontWeight: "700", fontSize: 14 },
  winnerCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    backgroundColor: "rgba(233,201,138,0.1)",
    borderWidth: 1,
    borderColor: "rgba(233,201,138,0.35)",
  },
  winnerTitle: { color: COLORS.gold, fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  scoreName: { width: 84, color: "#e6dac3", fontSize: 12 },
  scoreTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 4 },
  scoreVal: { width: 28, textAlign: "right", fontSize: 12, fontWeight: "700" },
});
