// still.tsx: the simulated video preview with the selected zone in turquoise.
// The "video" is a static image; nothing plays and nothing is captured or stored.
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Call } from "@/lib/review";
import { colors, radius, space } from "@/theme";

const kitchen = require("../assets/stream-kitchen.jpg");

export function Still({ call, compact = false }: { call: Call; compact?: boolean }) {
  const unclear = call.status === "suggested" && !!call.suggestion?.unclearCamera;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Simulated preview with the target zone marked${unclear ? ". The camera view is unclear" : ""}`}
      style={[s.frame, compact && { borderRadius: radius.md }]}
    >
      <Image source={kitchen} style={s.image} resizeMode="cover" blurRadius={unclear ? 3 : 0} />
      {unclear && <View style={s.dim} />}
      <View
        pointerEvents="none"
        style={[s.zone, { left: `${call.zone.x}%`, top: `${call.zone.y}%`, width: `${call.zone.w}%`, height: `${call.zone.h}%` }]}
      />
      {/* Opaque bar: the demo still carries its own "LIVE" badge and timestamp, which must not read as real. */}
      <View style={s.bar}>
        <Text style={s.barText}>Simulated preview · Demo data</Text>
        {unclear && !compact && (
          <View style={s.unclear}>
            <Ionicons name="eye-off" size={14} color="#fff" />
            <Text style={s.barText}>Camera view unclear</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden", backgroundColor: colors.foreground },
  image: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  dim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(17,30,59,0.25)" },
  zone: { position: "absolute", borderWidth: 3, borderColor: colors.zone, borderRadius: 4 },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: colors.foreground,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
  },
  barText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  unclear: { flexDirection: "row", alignItems: "center", gap: 4 },
});
