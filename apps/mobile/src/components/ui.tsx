// ui.tsx: shared building blocks (buttons, badges, headers, state cards, zone thumbnails).
// Every pressable is at least TOUCH (48 dp) tall and carries an accessibility role and label.
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Verdict, Zone } from "@/lib/review";
import { colors, radius, space, TOUCH } from "@/theme";

const kitchen = require("../assets/stream-kitchen.jpg");

export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return (
    <View style={s.demo}>
      <Text style={s.demoText}>{label}</Text>
    </View>
  );
}

const verdictStyle: Record<Verdict, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  YES: { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle" },
  NO: { bg: colors.destructiveSoft, fg: colors.destructive, icon: "close-circle" },
  UNKNOWN: { bg: colors.unknownSoft, fg: colors.unknown, icon: "help-circle" },
};

export function VerdictBadge({ verdict, canceled }: { verdict: Verdict; canceled?: boolean }) {
  const v = verdictStyle[verdict];
  return (
    <View
      accessible
      accessibilityLabel={`${verdict}${canceled ? ", canceled" : ""}`}
      style={[s.badge, { backgroundColor: v.bg }]}
    >
      <Ionicons name={v.icon} size={14} color={v.fg} />
      <Text style={[s.badgeText, { color: v.fg }]}>{verdict}</Text>
      {canceled && <Text style={[s.badgeText, { color: v.fg, fontWeight: "500" }]}>· canceled</Text>}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function Button({ label, onPress, variant = "primary", hint, icon }: ButtonProps) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(hint ? { accessibilityHint: hint } : {})}
      onPress={onPress}
      android_ripple={{ color: primary ? "#ffffff44" : "#11111122" }}
      style={({ pressed }) => [s.button, primary ? s.buttonPrimary : s.buttonSecondary, pressed && Platform.OS === "ios" && { opacity: 0.7 }]}
    >
      {icon && <Ionicons name={icon} size={18} color={primary ? colors.primaryForeground : colors.foreground} />}
      <Text style={[s.buttonText, { color: primary ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

/** Top bar. iOS centers the title, Android left-aligns it next to the back arrow. */
export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const center = Platform.OS === "ios";
  return (
    <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
      <View style={s.headerSide}>
        {onBack && (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={s.iconButton} hitSlop={4}>
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </Pressable>
        )}
      </View>
      <Text accessibilityRole="header" style={[s.headerTitle, center ? { textAlign: "center" } : { textAlign: "left" }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[s.headerSide, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

export function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={s.notice}>
      <Text style={s.noticeText}>{message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={onDismiss} style={s.iconButton}>
        <Ionicons name="close" size={20} color={colors.accentForeground} />
      </Pressable>
    </View>
  );
}

/** Empty and error states share one card so they read the same everywhere. */
export function StateCard({
  title,
  body,
  tone = "neutral",
  action,
}: {
  title: string;
  body: string;
  tone?: "neutral" | "error";
  action?: ReactNode;
}) {
  const error = tone === "error";
  return (
    <View
      accessibilityRole={error ? "alert" : "summary"}
      accessibilityLiveRegion={error ? "assertive" : "none"}
      style={[s.stateCard, error && { borderColor: colors.destructive, backgroundColor: colors.destructiveSoft }]}
    >
      <Text style={[s.stateTitle, error && { color: colors.destructive }]}>{title}</Text>
      <Text style={s.stateBody}>{body}</Text>
      {action}
    </View>
  );
}

export function Skeleton({ height }: { height: number }) {
  return <View style={[s.skeleton, { height }]} />;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={{ gap: space.md }}>
      <Skeleton height={56} />
      <Skeleton height={220} />
    </View>
  );
}

/** Decorative crop of the demo still around a zone. The still is static; no video is stored. */
export function ZoneThumb({ zone, width = 64, height = 44 }: { zone: Zone; width?: number; height?: number }) {
  const imgW = (width * 100) / zone.w;
  const imgH = (imgW * 9) / 16;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width, height, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.muted }}
    >
      <Image
        source={kitchen}
        style={{ width: imgW, height: imgH, marginLeft: -(zone.x / 100) * imgW, marginTop: -(zone.y / 100) * imgH }}
      />
    </View>
  );
}

export const card: StyleProp<ViewStyle> = {
  backgroundColor: colors.card,
  borderRadius: radius.lg,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.border,
  padding: space.lg,
};

const s = StyleSheet.create({
  demo: {
    alignSelf: "flex-start",
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  demoText: { fontSize: 12, fontWeight: "500", color: colors.mutedForeground },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
  button: {
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    overflow: "hidden",
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.secondary },
  buttonText: { fontSize: 16, fontWeight: "700" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSide: { width: 96, minHeight: TOUCH, justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.foreground },
  iconButton: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingLeft: space.lg,
  },
  noticeText: { flex: 1, color: colors.accentForeground, fontSize: 14, paddingVertical: space.md },
  stateCard: {
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: space.xl,
  },
  stateTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  stateBody: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  skeleton: { borderRadius: radius.lg, backgroundColor: colors.muted },
});
