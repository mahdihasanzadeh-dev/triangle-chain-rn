import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildBoard } from "../game/logic";
import { COLORS, PALETTE, SIZE_OPTIONS } from "../theme";

export default function SetupScreen({
  sizeN,
  setSizeN,
  playerCount,
  setPlayerCount,
  vsAI,
  setVsAI,
  onStart,
  onShowGuide,
}) {
  const insets = useSafeAreaInsets();

  const previews = useMemo(() => {
    const map = {};
    SIZE_OPTIONS.forEach((o) => (map[o.n] = buildBoard(o.n)));
    return map;
  }, []);
  const selectedPreview = previews[sizeN];
  const selectedOpt = SIZE_OPTIONS.find((o) => o.n === sizeN);

  const activePlayers = PALETTE.slice(0, playerCount).map((p, idx) => ({
    ...p,
    label: vsAI && idx === 1 ? "AI" : `Player ${idx + 1}`,
  }));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Triangle Chain</Text>
        <Text style={styles.subtitle}>
          A digital star-web of the classic peg-and-rubber-band chain triangle game &mdash;
          stretch a band between two pegs, close a triangle, claim it.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Board size</Text>
          <View style={styles.row3}>
            {SIZE_OPTIONS.map((opt) => {
              const active = sizeN === opt.n;
              const b = previews[opt.n];
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => setSizeN(opt.n)}
                  style={[styles.sizeBtn, active && styles.sizeBtnActive]}
                >
                  <Text style={[styles.sizeLabel, active && styles.sizeLabelActive]}>{opt.label}</Text>
                  <Text style={styles.sizeSub}>
                    {opt.sub} &middot; {b.faces.length} tri
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 20 }]}>Players</Text>
          <View style={styles.row2}>
            {[2, 3].map((pc) => {
              const active = playerCount === pc;
              return (
                <Pressable
                  key={pc}
                  onPress={() => {
                    setPlayerCount(pc);
                    if (pc !== 2) setVsAI(false);
                  }}
                  style={[styles.pcBtn, active && styles.pcBtnActive]}
                >
                  <Text style={[styles.pcText, active && styles.pcTextActive]}>{pc} Players</Text>
                </Pressable>
              );
            })}
          </View>

          {playerCount === 2 && (
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Play against the computer</Text>
              <Switch
                value={vsAI}
                onValueChange={setVsAI}
                trackColor={{ false: "rgba(255,255,255,0.14)", true: "#3ecf8e" }}
                thumbColor="#fff"
              />
            </View>
          )}

          <Pressable onPress={onShowGuide} style={{ marginTop: 16 }}>
            <Text style={styles.guideLink}>How to play &rarr;</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Preview</Text>
          <Text style={styles.previewText}>
            {selectedOpt.label} board &middot; {selectedPreview.faces.length} triangles
          </Text>
          <View style={styles.chipsRow}>
            {activePlayers.map((p, idx) => (
              <View key={idx} style={styles.chip}>
                <View style={[styles.dot, { backgroundColor: p.color }]} />
                <Text style={styles.chipText}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <Pressable onPress={onStart} style={styles.startBtn}>
          <Text style={styles.startBtnText}>
            Start Game &middot; {selectedOpt.label} &middot; {playerCount}P{vsAI ? " vs AI" : ""}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  h1: {
    color: COLORS.gold,
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.goldDim,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 16,
  },
  label: {
    color: COLORS.gold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row3: { flexDirection: "row", gap: 8 },
  sizeBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(233,201,138,0.2)",
    minHeight: 76,
    justifyContent: "center",
  },
  sizeBtnActive: {
    backgroundColor: "rgba(233,201,138,0.16)",
    borderColor: COLORS.gold,
  },
  sizeLabel: { color: COLORS.text, fontWeight: "600", fontSize: 14 },
  sizeLabelActive: { color: COLORS.gold },
  sizeSub: { color: COLORS.textDim, fontSize: 10, marginTop: 4, textAlign: "center" },
  row2: { flexDirection: "row", gap: 8 },
  pcBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(233,201,138,0.25)",
  },
  pcBtnActive: { backgroundColor: COLORS.gold },
  pcText: { color: COLORS.text, fontWeight: "500", fontSize: 14 },
  pcTextActive: { color: "#1a1208" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(233,201,138,0.15)",
  },
  toggleLabel: { color: COLORS.text, fontSize: 14 },
  guideLink: { color: COLORS.goldDim, fontSize: 14, textDecorationLine: "underline" },
  previewText: { color: COLORS.text, fontSize: 14, marginBottom: 10 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  chipText: { color: "#e6dac3", fontSize: 12 },
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  startBtn: {
    backgroundColor: "#3ecf8e",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  startBtnText: { color: "#0b2117", fontWeight: "700", fontSize: 15 },
});
