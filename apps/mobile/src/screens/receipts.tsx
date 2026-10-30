// receipts.tsx: Receipts tab (list with outcome filter) and the receipt detail screen.
// Only confirmed outcomes appear here. A receipt shows outcome, event time, rule and evidence hash.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, card, DemoBadge, LoadingBlock, Notice, ScreenHeader, StateCard, VerdictBadge, ZoneThumb } from "@/components/ui";
import { formatEventTime } from "@/lib/format";
import type { Receipt, Verdict } from "@/lib/review";
import type { ReviewSession } from "@/lib/use-review-session";
import { colors, radius, space, TOUCH } from "@/theme";

type Filter = "ALL" | Verdict;
const filters: { id: Filter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "YES", label: "Yes" },
  { id: "NO", label: "No" },
  { id: "UNKNOWN", label: "Unknown" },
];

export function ReceiptsScreen({ session, onOpen }: { session: ReviewSession; onOpen: (callId: string) => void }) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("ALL");
  const shown = session.receipts.filter((r) => filter === "ALL" || r.verdict === filter);
  return (
    <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + space.lg }]}>
      <View style={s.titleRow}>
        <Text accessibilityRole="header" style={s.title}>Receipts</Text>
        <DemoBadge />
      </View>
      <Text style={s.subtitle}>A record of outcomes you confirmed.</Text>
      {session.notice && <Notice message={session.notice} onDismiss={session.dismissNotice} />}

      <View accessibilityRole="tablist" style={s.chips}>
        {filters.map((f) => {
          const on = f.id === filter;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="tab"
              accessibilityLabel={f.label}
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f.id)}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipText, on && { color: colors.primaryForeground }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {session.booting ? (
        <LoadingBlock label="Loading receipts" />
      ) : shown.length === 0 ? (
        <StateCard
          title={session.receipts.length === 0 ? "No receipts yet" : "No receipts match"}
          body={session.receipts.length === 0 ? "Confirm a suggestion to create one." : "Try another filter."}
        />
      ) : (
        shown.map((r) => (
          <Pressable
            key={r.callId}
            accessibilityRole="button"
            accessibilityLabel={`${r.question}, ${r.verdict}${r.canceled ? ", canceled" : ""}, ${formatEventTime(r.eventTime)}`}
            accessibilityHint="Opens the receipt"
            onPress={() => onOpen(r.callId)}
            style={[card, s.row]}
          >
            <ZoneThumb zone={r.zone} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.rowTitle}>{r.question}</Text>
              <Text style={s.rowMeta}>{formatEventTime(r.eventTime)}</Text>
            </View>
            <VerdictBadge verdict={r.verdict} canceled={r.canceled} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const explainer = (r: Receipt) =>
  r.canceled
    ? "This call was marked UNKNOWN, so it was canceled and no result is counted. In this prototype nothing was refunded or sent anywhere."
    : "A receipt records the rule and the evidence that were used. It does not prove what happened on camera.";

export function ReceiptDetailScreen({ session, callId, onBack }: { session: ReviewSession; callId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const r = session.receipts.find((x) => x.callId === callId);
  const v = r?.verdict;
  const palette = v === "YES" ? [colors.successSoft, colors.success] : v === "NO" ? [colors.destructiveSoft, colors.destructive] : [colors.unknownSoft, colors.unknown];
  return (
    <View style={s.screen}>
      <ScreenHeader title="Receipt" onBack={onBack} right={<DemoBadge />} />
      <ScrollView contentContainerStyle={[s.content, { paddingTop: space.lg, paddingBottom: insets.bottom + space.xl }]}>
        {!r ? (
          <StateCard title="Receipt not found" body="Only confirmed outcomes have receipts." action={<Button label="Back" variant="secondary" onPress={onBack} />} />
        ) : (
          <>
            <View accessible accessibilityLabel={`${r.verdict}${r.canceled ? ", canceled" : ", confirmed"}`} style={[card, s.summary]}>
              <View style={[s.summaryIcon, { backgroundColor: palette[0] }]}>
                <Ionicons name={v === "YES" ? "checkmark" : v === "NO" ? "close" : "help"} size={30} color={palette[1]} />
              </View>
              <View>
                <Text style={s.verdict}>{r.verdict}</Text>
                <Text style={s.verdictSub}>{r.canceled ? "Canceled" : "Confirmed"}</Text>
              </View>
            </View>

            <View style={[card, { gap: space.lg }]}>
              <Info icon="time-outline" label={formatEventTime(r.eventTime)} sub="Event time · reviewed by you (simulated)" />
              <Info icon="document-text-outline" label="Rule" sub={r.rule} />
              <Info icon="information-circle-outline" label="Source" sub={r.source === "camera-metrics" ? "Camera metrics (client-reported)" : "Offline or replay"} />
              <Info icon="finger-print-outline" label="Evidence hash" sub={r.evidenceHash ?? "Not available"} mono />
            </View>

            <View style={s.explainer}>
              <Ionicons name="information-circle-outline" size={22} color={colors.accentForeground} />
              <Text style={s.explainerText}>{explainer(r)}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Info({ icon, label, sub, mono }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; mono?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}. ${sub}`} style={s.info}>
      <View style={s.infoIcon}>
        <Ionicons name={icon} size={20} color={colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoSub, mono && { fontFamily: "monospace" }]}>{sub}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 30, fontWeight: "800", color: colors.foreground },
  subtitle: { fontSize: 16, color: colors.mutedForeground, marginTop: -space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH + 24 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  rowMeta: { fontSize: 13, color: colors.mutedForeground },
  summary: { flexDirection: "row", alignItems: "center", gap: space.lg },
  summaryIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  verdict: { fontSize: 30, fontWeight: "800", color: colors.foreground },
  verdictSub: { fontSize: 20, fontWeight: "500", color: colors.mutedForeground },
  info: { flexDirection: "row", gap: space.md },
  infoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  infoSub: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  explainer: { flexDirection: "row", gap: space.md, backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg },
  explainerText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.accentForeground },
});

