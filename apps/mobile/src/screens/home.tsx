// home.tsx: Home and Calls tabs: pending-review banner and concise call cards.
// Home shows only what needs review; Calls lists every simulated call with where it stands.
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Still } from "@/components/still";
import { Button, card, DemoBadge, LoadingBlock, Notice, StateCard } from "@/components/ui";
import { formatEventTime } from "@/lib/format";
import { supporterCount, type Call } from "@/lib/review";
import type { ReviewSession } from "@/lib/use-review-session";
import { colors, radius, space, TOUCH } from "@/theme";

interface Props {
  session: ReviewSession;
  onReview: (callId: string) => void;
}

const greeting = (h = new Date().getHours()) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

export function HomeScreen({ session, onReview }: Props) {
  const insets = useSafeAreaInsets();
  const n = session.pending.length;
  const first = session.pending[0];
  return (
    <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + space.lg }]}>
      <View style={s.brandRow}>
        <View style={s.brand}>
          <View style={s.logo}>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </View>
          <Text accessibilityRole="header" style={s.brandText}>Called It</Text>
        </View>
        <DemoBadge />
      </View>

      <View>
        <Text accessibilityRole="header" style={s.title}>{greeting()}, Alex</Text>
        <Text style={s.subtitle}>Here’s what needs your attention.</Text>
      </View>

      {session.notice && <Notice message={session.notice} onDismiss={session.dismissNotice} />}

      {session.booting ? (
        <LoadingBlock label="Loading calls" />
      ) : !session.connected ? (
        <StateCard title="Server disconnected" body="Waiting for the local server. Data may be stale." action={<Button label="Retry connection" onPress={session.reset} />} />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={n === 0 ? "All caught up" : `${n} ${n === 1 ? "call needs" : "calls need"} review`}
            accessibilityHint={n === 0 ? "" : "Opens the first call to review"}
            disabled={!first}
            onPress={() => first && onReview(first.id)}
            style={s.banner}
          >
            <Ionicons name="time-outline" size={26} color={colors.twitch} />
            <Text style={s.bannerText}>{n === 0 ? "All caught up" : `${n} ${n === 1 ? "call needs" : "calls need"} review`}</Text>
            {n > 0 && <Ionicons name="chevron-forward" size={20} color={colors.twitch} />}
          </Pressable>

          <View style={s.sectionRow}>
            <Text accessibilityRole="header" style={s.section}>Pending calls</Text>
            <View style={s.count}>
              <Text style={s.countText}>{n}</Text>
            </View>
          </View>

          {n === 0 ? (
            <StateCard title="All caught up" body="No calls are waiting for review. New simulated proposals will appear here." />
          ) : (
            session.pending.map((c) => <CallCard key={c.id} call={c} status={session.oracle[c.id]} onReview={() => onReview(c.id)} />)
          )}
        </>
      )}
    </ScrollView>
  );
}

function CallCard({ call, status, onReview }: { call: Call; status: "loading" | "error" | undefined; onReview: () => void }) {
  return (
    <View style={[card, { gap: space.md }]}>
      <Still call={call} compact />
      <View style={s.cardRow}>
        <Text accessibilityRole="header" style={s.cardTitle}>{call.question}</Text>
        <Text style={s.cardTime}>{formatEventTime(call.eventTime)}</Text>
      </View>
      <Text style={s.cardMeta}>
        {supporterCount(call)} supporters · {statusLabel(call, status)}
      </Text>
      <Button label="Review call" icon="chevron-forward" onPress={onReview} hint={`Opens ${call.question}`} />
    </View>
  );
}

export const statusLabel = (c: Call, o?: "loading" | "error") =>
  ({
    proposed: "Proposal waiting",
    awaiting_suggestion: o === "error" ? "Oracle error" : "Oracle checking",
    suggested: c.suggestion?.unclearCamera ? "Camera view unclear" : "Suggestion ready",
    proposal_rejected: "Proposal rejected",
    suggestion_rejected: "Suggestion rejected · no outcome",
    confirmed: "Confirmed",
  })[c.status];

export function CallsScreen({ session, onReview }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + space.lg }]}>
      <Text accessibilityRole="header" style={s.title}>Calls</Text>
      <Text style={s.subtitle}>Simulated viewer proposals and where each one stands.</Text>
      {session.notice && <Notice message={session.notice} onDismiss={session.dismissNotice} />}
      {session.booting ? (
        <LoadingBlock label="Loading calls" />
      ) : session.calls.length === 0 ? (
        <StateCard title="No calls yet" body="Simulated proposals will appear here." />
      ) : (
        session.calls.map((c) => {
          const open = session.pending.some((p) => p.id === c.id);
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.question}, ${supporterCount(c)} supporters, ${statusLabel(c, session.oracle[c.id])}`}
              accessibilityHint={open ? "Opens the review" : "Already reviewed"}
              disabled={!open}
              onPress={() => onReview(c.id)}
              style={[card, s.callRow, !open && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{c.question}</Text>
                <Text style={s.cardMeta}>
                  {supporterCount(c)} supporters · {statusLabel(c, session.oracle[c.id])}
                </Text>
              </View>
              {open && <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />}
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  logo: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.twitch, alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: 24, fontWeight: "800", color: colors.foreground },
  title: { fontSize: 30, fontWeight: "800", color: colors.foreground },
  subtitle: { fontSize: 16, color: colors.mutedForeground, marginTop: 2 },
  banner: {
    minHeight: TOUCH + 12,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.twitchSoft,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
  },
  bannerText: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.twitch },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  section: { fontSize: 20, fontWeight: "800", color: colors.foreground },
  count: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  countText: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground },
  cardRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md, alignItems: "flex-start" },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.foreground },
  cardTime: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  cardMeta: { fontSize: 14, color: colors.mutedForeground },
  callRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH + 16 },
});

