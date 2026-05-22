import React from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { COLORS, RADIUS, SPACING } from "../utils/theme";

export const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => <View style={[s.card, style]}>{children}</View>;

export const ScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ title, subtitle, right }) => (
  <View style={s.header}>
    <View style={{ flex: 1 }}>
      <Text style={s.headerEyebrow}>Controle financeiro</Text>
      <Text style={s.headerTitle}>{title}</Text>
      {!!subtitle && <Text style={s.headerSubtitle}>{subtitle}</Text>}
    </View>
    {right}
  </View>
);

export const ActionTile: React.FC<{
  title: string;
  subtitle?: string;
  icon?: string;
  onPress: () => void;
  tone?: "info" | "success" | "warning" | "danger";
}> = ({ title, subtitle, icon = "›", onPress, tone = "info" }) => {
  const toneColor =
    tone === "success" ? COLORS.success : tone === "warning" ? COLORS.warning : tone === "danger" ? COLORS.danger : COLORS.info;
  const toneBg =
    tone === "success" ? COLORS.successBg : tone === "warning" ? COLORS.warningBg : tone === "danger" ? COLORS.dangerBg : COLORS.infoBg;
  return (
    <TouchableOpacity style={s.tile} activeOpacity={0.82} onPress={onPress}>
      <View style={[s.tileIcon, { backgroundColor: toneBg }]}>
        <Text style={{ color: toneColor, fontWeight: "900", fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.tileTitle}>{title}</Text>
        {!!subtitle && <Text style={s.tileSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={s.tileArrow}>›</Text>
    </TouchableOpacity>
  );
};

export const Section: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <View style={{ marginBottom: SPACING.md }}>
    <Text style={s.sectionTitle}>{title}</Text>
    {children}
  </View>
);

export const ScreenScroll: React.FC<{
  children: React.ReactNode;
  style?: any;
  contentStyle?: any;
}> = ({ children, style, contentStyle }) => {
  const tabBarHeight = 0;
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: COLORS.bg }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        { padding: SPACING.md, paddingBottom: tabBarHeight + 36 },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
};

export const Field: React.FC<{
  label: string;
  value: string | number | null | undefined;
  onChangeText?: (t: string) => void;
  onChange?: (t: string) => void;
  placeholder?: string;
  keyboardType?:
    | "default"
    | "numeric"
    | "decimal-pad"
    | "email-address"
    | "phone-pad"
    | "number-pad";
  multiline?: boolean;
}> = ({
  label,
  value,
  onChangeText,
  onChange,
  placeholder,
  keyboardType = "default",
  multiline = false,
}) => {
  const handler = onChangeText || onChange || (() => {});
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          s.input,
          multiline && { minHeight: 76, textAlignVertical: "top" },
        ]}
        value={value === null || value === undefined ? "" : String(value)}
        onChangeText={handler}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        selectTextOnFocus={
          keyboardType === "decimal-pad" ||
          keyboardType === "numeric" ||
          keyboardType === "number-pad"
        }
      />
    </View>
  );
};

export const MoneyField: React.FC<{
  label: string;
  value: any;
  onChange: (n: number) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <Field
    label={label}
    value={
      value === null || value === undefined || value === 0
        ? ""
        : String(value).replace(".", ",")
    }
    keyboardType="decimal-pad"
    placeholder={placeholder || "0,00"}
    onChangeText={(text) => {
      const normalized = text.replace(/[^0-9,.-]/g, "").replace(",", ".");
      const n = Number.parseFloat(normalized);
      onChange(Number.isFinite(n) ? n : 0);
    }}
  />
);

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const DateField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  mode?: "date" | "month";
}> = ({ label, value, onChange, mode = "date" }) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={mode === "month" ? "YYYY-MM" : "YYYY-MM-DD"}
      />
      <View style={s.quickRow}>
        <TouchableOpacity
          style={s.quickChip}
          onPress={() => onChange(mode === "month" ? currentMonth : todayYMD())}
        >
          <Text style={s.quickText}>
            {mode === "month" ? "Mês atual" : "Hoje"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.quickChip} onPress={() => onChange("")}>
          <Text style={s.quickText}>Limpar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface ChoiceProps<T extends string> {
  label?: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}
export function ChoicePills<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceProps<T>) {
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      {label && <Text style={s.fieldLabel}>{label}</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[s.pill, value === opt && s.pillActive]}
          >
            <Text style={[s.pillText, value === opt && s.pillTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

interface BtnProps {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  full?: boolean;
  disabled?: boolean;
}
export const Button: React.FC<BtnProps> = ({
  title,
  onPress,
  variant = "primary",
  full,
  disabled,
}) => {
  const bg =
    variant === "primary"
      ? COLORS.info
      : variant === "secondary"
        ? COLORS.warning
        : variant === "danger"
          ? COLORS.danger
          : "transparent";
  const color = variant === "ghost" ? COLORS.info : "#fff";
  const border =
    variant === "ghost" ? { borderWidth: 1, borderColor: COLORS.info } : {};
  return (
    <TouchableOpacity
      onPress={() => {
        if (!disabled) void onPress();
      }}
      disabled={disabled}
      activeOpacity={0.78}
      style={[
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.55 : 1 },
        full && { alignSelf: "stretch" },
        border,
      ]}
    >
      <Text style={[s.btnText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );
};

export const Stat: React.FC<{
  label: string;
  value: string;
  color?: string;
}> = ({ label, value, color = COLORS.text }) => (
  <View style={s.stat}>
    <Text style={s.statLabel}>{label}</Text>
    <Text style={[s.statValue, { color }]}>{value}</Text>
  </View>
);

export const SwitchRow: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <TouchableOpacity
    style={s.switchRow}
    onPress={() => onChange(!value)}
    activeOpacity={0.7}
  >
    <Text style={{ color: COLORS.text, fontSize: 14 }}>{label}</Text>
    <View style={[s.switch, value && { backgroundColor: COLORS.info }]}>
      <View style={[s.switchKnob, value && { left: 22 }]} />
    </View>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerEyebrow: {
    color: COLORS.info,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({ android: { elevation: 1 }, default: {} }),
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  tileSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  tileArrow: { color: COLORS.muted, fontSize: 22, fontWeight: "700" },
  card: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({ android: { elevation: 2 }, default: {} }),
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  fieldLabel: { fontSize: 12, color: COLORS.muted, marginBottom: 6, fontWeight: "700" },
  input: {
    backgroundColor: COLORS.neutralBg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
  },
  quickRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  quickChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  quickText: { color: COLORS.info, fontSize: 12, fontWeight: "700" },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  pillActive: { backgroundColor: COLORS.info, borderColor: COLORS.info },
  pillText: { color: COLORS.muted, fontSize: 13, fontWeight: "500" },
  pillTextActive: { color: "#fff", fontWeight: "700" },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  btnText: { fontSize: 14, fontWeight: "700" },
  stat: { flex: 1, padding: SPACING.sm, minWidth: "48%", backgroundColor: COLORS.neutralBg, borderRadius: RADIUS.md, margin: 3 },
  statLabel: { fontSize: 11, color: COLORS.muted, marginBottom: 3, fontWeight: "700" },
  statValue: { fontSize: 18, fontWeight: "900" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  switch: {
    width: 44,
    height: 24,
    backgroundColor: COLORS.border,
    borderRadius: 999,
    padding: 2,
    justifyContent: "center",
  },
  switchKnob: {
    width: 20,
    height: 20,
    backgroundColor: "#fff",
    borderRadius: 999,
    left: 0,
    position: "absolute",
  },
});
