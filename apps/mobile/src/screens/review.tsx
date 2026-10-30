// review.tsx: Review screen: simulated video with the selected zone, question, supporters, oracle
// suggestion and reason, and explicit confirm / reject. Nothing is final until the streamer confirms.
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { AccessibilityInfo, ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Still } from "@/components/still";
import { Button, DemoBadge, ScreenHeader, StateCard, VerdictBadge } from "@/components/ui";
import { supporterCount } from "@/lib/review";
import type { ReviewSession } from "@/lib/use-review-session";
import { colors, radius, space } from "@/theme";

interface Props {
  session: ReviewSession;
  callId: string;
  onBack: () => void;
  /** Called after a confirmation with the id of the call that now has a receipt. */
  onConfirmed: (callId: string) => void;
}

export function ReviewScreen({ session, callId, onBack, onConfirmed }: Props) {
  const insets = useSafeAreaInsets();
  const call = session.calls.find((c) => c.id === callId);
  const status = session.oracle[callId];

  // iOS has no live regions: announce the oracle error so VoiceOver users hear it.
  useEffect(() => {
    if (status === "error") AccessibilityInfo.announceForAccessibility("Couldn’t get a suggestion. Nothing has been decided.");
  }, [status]);

  return (
    <View style={s.screen}>
      <ScreenHeader title="Review call" onBack={onBack} right={<DemoBadge />} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xl }]}>
        {!call ? (
          <View style={{ padding: space.lg }}>
            <StateCard title="Call not found" body="This simulated call is no longer available." action={<Button label="Back to calls" variant="secondary" onPress={onBack} />} />
          </View>
        ) : (
          <>
            <Still call={call} />
            <View style={s.body}>
              <Text accessibilityRole="header" style={s.question}>{call.question}</Text>
              <View style={s.metaRow}>
                <Ionicons name="people" size={18} color={colors.mutedForeground} />
                <Text style={s.meta}>{supporterCount(call)} supporters</Text>
              </View>
              <Text style={s.rule}>
                <Text style={{ fontWeight: "700", color: colors.foreground }}>Rule: </Text>
                {call.rule}
              </Text>

              {call.status === "proposed" && (
                <View style={s.actions}>
                  <Button label="Approve proposal" onPress={() => session.approve(call)} />
                  <Button
                    label="Reject proposal"
                    variant="secondary"
                    onPress={() => {
                      session.rejectProposal(call);
                      onBack();
                    }}
                  />
                </View>
              )}

              {call.status === "awaiting_suggestion" && status !== "error" && (
                <View accessible accessibilityLiveRegion="polite" accessibilityLabel="Simulated oracle is checking the marked zone" style={s.checking}>
                  <ActivityIndicator color={colors.primary} /><Button label="Use UNKNOWN without camera" variant="secondary" onPress={() => session.retryOracle(call)} />
                  <Text style={s.checkingText}>Awaiting camera observation on web, or use offline UNKNOWN.</Text>
                </View>
              )}

              {call.status === "awaiting_suggestion" && status === "error" && (
                <StateCard
                  tone="error"
                  title="Couldn’t get a suggestion"
                  body="The simulated oracle timed out. Nothing has been decided."
                  action={<Button label="Try again" variant="secondary" onPress={() => session.retryOracle(call)} />}
                />
              )}

              {call.status === "suggested" && call.suggestion && (
                <>
                  <View
                    accessible
                    accessibilityLabel={`Oracle suggestion, simulated and not final: ${call.suggestion.verdict}. ${call.suggestion.unclearCamera ? "Camera view unclear. " : ""}${call.suggestion.reason}`}
                    style={s.suggestion}
                  >
                    <View style={s.suggestionTitle}>
                      <Ionicons name="sparkles" size={18} color={colors.twitch} />
                      <Text style={s.suggestionLabel}>Oracle suggestion</Text>
                    </View>
                    <VerdictBadge verdict={call.suggestion.verdict} />
                    {call.suggestion.unclearCamera && <Text style={s.unclear}>Camera view unclear</Text>}
                    <Text style={s.reason}>{call.suggestion.reason}</Text>
                    <Text style={s.fine}>
                      {call.suggestion.source === "camera-metrics" ? "Camera measurements from the local browser; not verified and not final until confirmed." : "Offline suggestion; not final until confirmed."}
                      {call.suggestion.verdict === "UNKNOWN" && " Confirming UNKNOWN cancels the call. It is not treated as NO."}
                    </Text>
                  </View>
                  <View style={s.actions}>
                    <Button
                      label={`Confirm ${call.suggestion.verdict}`}
                      hint={call.suggestion.verdict === "UNKNOWN" ? "Cancels the call. It is not treated as NO." : "Creates a receipt"}
                      onPress={() => {
                        void session.confirm(call).then((ok) => { if (ok) onConfirmed(call.id); });
                      }}
                    />
                    <Button
                      label="Reject suggestion"
                      variant="secondary"
                      hint="Leaves the call without an outcome and creates no receipt"
                      onPress={() => {
                        session.rejectSuggestion(call);
                        onBack();
                      }}
                    />
                  </View>
                </>
              )}

              {!["proposed", "awaiting_suggestion", "suggested"].includes(call.status) && (
                <StateCard title="Already handled" body="This call is no longer waiting for review." action={<Button label="Back" variant="secondary" onPress={onBack} />} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: space.lg },
  body: { paddingHorizontal: space.lg, gap: space.md },
  question: { fontSize: 26, fontWeight: "800", color: colors.foreground },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  meta: { fontSize: 16, fontWeight: "600", color: colors.mutedForeground },
  rule: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  actions: { gap: space.sm, marginTop: space.sm },
  checking: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.muted, borderRadius: radius.lg, padding: space.lg },
  checkingText: { flex: 1, fontSize: 14, color: colors.foreground },
  suggestion: { gap: space.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: space.lg },
  suggestionTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  suggestionLabel: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  unclear: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  reason: { fontSize: 15, lineHeight: 22, color: colors.foreground },
  fine: { fontSize: 12, lineHeight: 17, color: colors.mutedForeground },
});



