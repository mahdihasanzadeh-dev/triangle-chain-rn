import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS } from "../theme";

export default function GuideModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>How to Play</Text>

          <View style={styles.row}>
            <Text style={styles.bullet}>1.</Text>
            <Text style={styles.body}>
              On your turn, press a peg and drag &mdash; just like grabbing a real rubber band.
              Glowing pegs show every legal peg to stretch it to.
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.bullet}>2.</Text>
            <Text style={styles.body}>
              Release on a glowing peg to hook the band and claim any triangle it completes. It
              fills with your color and you get an instant bonus turn. Let go anywhere else and
              the band snaps back &mdash; no harm done.
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.bullet}>3.</Text>
            <Text style={styles.body}>
              Bands are free to cross paths formed by earlier bands &mdash; that's how new
              triangles appear in the middle of the star.
            </Text>
          </View>

          <Text style={styles.footer}>
            When every triangle is claimed, whoever holds the most triangles wins. Drag empty
            space to rotate the board, and pinch or scroll to zoom.
          </Text>

          <Pressable style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8,5,3,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#1b140d",
    borderWidth: 1,
    borderColor: "rgba(233,201,138,0.3)",
  },
  title: {
    color: COLORS.gold,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  bullet: {
    color: COLORS.gold,
    fontWeight: "700",
    width: 18,
  },
  body: {
    flex: 1,
    color: "#e6dac3",
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    color: "#e6dac3",
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(233,201,138,0.15)",
    marginBottom: 16,
  },
  btn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: {
    color: "#1a1208",
    fontWeight: "700",
    fontSize: 15,
  },
});
