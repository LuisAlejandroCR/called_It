// App.tsx: root of the mobile prototype: three tabs (Home, Calls, Receipts) plus pushed Review and
// Receipt screens, with a tiny stack and Android hardware-back handling. All data is simulated.
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AccessibilityInfo, BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { createSimulatedOracle, type Oracle } from "@/lib/demo-data";
import { useReviewSession } from "@/lib/use-review-session";
import { CallsScreen, HomeScreen } from "@/screens/home";
import { ReceiptDetailScreen, ReceiptsScreen } from "@/screens/receipts";
import { ReviewScreen } from "@/screens/review";
import { colors, TOUCH } from "@/theme";

type Tab = "home" | "calls" | "receipts";
type Route = { name: "review"; callId: string } | { name: "receipt"; callId: string };

const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { id: "home", label: "Home", icon: "home-outline", active: "home" },
  { id: "calls", label: "Calls", icon: "list-outline", active: "list" },
  { id: "receipts", label: "Receipts", icon: "document-text-outline", active: "document-text" },
];

const defaultOracle = createSimulatedOracle();

export default function App(props: { oracle?: Oracle; bootDelay?: number }) {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Shell {...props} />
    </SafeAreaProvider>
  );
}

function Shell({ oracle = defaultOracle, bootDelay = 600 }: { oracle?: Oracle; bootDelay?: number }) {
  const session = useReviewSession(oracle, bootDelay);
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Route[]>([]);
  const top = stack[stack.length - 1];

  const push = (r: Route) => setStack((s) => [...s, r]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const replace = (r: Route) => setStack((s) => [...s.slice(0, -1), r]);

  // Android hardware back: pop a pushed screen, then return to Home, then let the OS leave the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length > 0) return pop(), true;
      if (tab !== "home") return setTab("home"), true;
      return false;
    });
    return () => sub.remove();
  }, [stack.length, tab]);

  // Screen readers: announce each new message (liveRegion covers Android, announce covers iOS).
  useEffect(() => {
    if (session.notice) AccessibilityInfo.announceForAccessibility(session.notice);
  }, [session.notice]);

  return (
    <View style={s.root}>
      <View style={s.screen}>
        {top?.name === "review" ? (
          <ReviewScreen session={session} callId={top.callId} onBack={pop} onConfirmed={(id) => replace({ name: "receipt", callId: id })} />
        ) : top?.name === "receipt" ? (
          <ReceiptDetailScreen session={session} callId={top.callId} onBack={pop} />
        ) : tab === "home" ? (
          <HomeScreen session={session} onReview={(id) => push({ name: "review", callId: id })} />
        ) : tab === "calls" ? (
          <CallsScreen session={session} onReview={(id) => push({ name: "review", callId: id })} />
        ) : (
          <ReceiptsScreen session={session} onOpen={(id) => push({ name: "receipt", callId: id })} />
        )}
      </View>
      {!top && <TabBar tab={tab} onChange={setTab} />}
    </View>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 8 : 4) }]}>
      {tabs.map((t) => {
        const on = t.id === tab;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.id)}
            style={s.tab}
          >
            <Ionicons name={on ? t.active : t.icon} size={24} color={on ? colors.primary : colors.mutedForeground} />
            <Text style={[s.tabLabel, { color: on ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, minHeight: TOUCH + 8, alignItems: "center", justifyContent: "center", gap: 2 },
  tabLabel: { fontSize: 12, fontWeight: "600" },
});
