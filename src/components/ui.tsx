import React from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import createIconSet from "@expo/vector-icons/createIconSet";
import { bankGlyphs } from "../data/bankGlyphs";
import { Ionicons } from "@expo/vector-icons";
import { getBank } from "../data/banks";
import { bankLogos } from "../data/bankLogos";
import { useTheme, ThemeColors } from "../theme/ThemeProvider";
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const { colors, styles } = useUI();
  return (
    <Ionicons name={name as any} size={size} color={color ?? colors.muted} />
  );
}
const BrazilianBankIcon = createIconSet(
  bankGlyphs,
  "Fonte-Bancos-Brasileiros",
  require("../../assets/fonts/Fonte-Bancos-Brasileiros.ttf"),
);

export function BankIcon({ bank, size = 42 }: { bank: string; size?: number }) {
  const { colors, styles } = useUI();
  const b = getBank(bank);
  const logo = bankLogos[bank];
  return (
    <View
      accessibilityLabel={b.name}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: logo ? "#ffffff" : b.color,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {logo ? (
        <Image
          source={logo}
          resizeMode="contain"
          style={{ width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      ) : bankGlyphs[bank] ? (
        <BrazilianBankIcon name={bank} size={size * 0.65} color="#fff" />
      ) : bank === "wallet" ? (
        <Icon name="wallet-outline" color="#fff" size={size * 0.55} />
      ) : (
        <Icon name="business-outline" color="#fff" size={size * 0.55} />
      )}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  icon,
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors, styles } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && { backgroundColor: colors.danger },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.bg} />
      ) : (
        <>
          {icon && (
            <Icon
              name={icon}
              size={18}
              color={danger ? colors.red : secondary ? colors.text : colors.bg}
            />
          )}
          <Text
            style={[
              styles.buttonText,
              {
                color: danger
                  ? colors.red
                  : secondary
                    ? colors.text
                    : colors.bg,
              },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard = "default",
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: "default" | "decimal-pad" | "number-pad";
  multiline?: boolean;
  maxLength?: number;
}) {
  const { colors, styles } = useUI();
  return (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboard}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          styles.input,
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors, styles } = useUI();
  return <View style={[styles.panel, style]}>{children}</View>;
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors, styles } = useUI();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}>
          <Text
            style={{ color: colors.green, fontSize: 12, fontWeight: "600" }}
          >
            {action} ›
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function Empty({
  icon,
  title,
  description,
  action,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors, styles } = useUI();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} color={colors.green} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action && onPress && (
        <Button title={action} onPress={onPress} secondary icon="add" />
      )}
    </View>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  const { colors, styles } = useUI();
  return (
    <View
      style={{
        height: 6,
        borderRadius: 8,
        backgroundColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 6,
          borderRadius: 8,
          width: `${Math.max(0, Math.min(100, value * 100))}%`,
          backgroundColor: color ?? colors.green,
        }}
      />
    </View>
  );
}
export function Choice({
  title,
  active,
  onPress,
  icon,
  color,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
  icon?: string;
  color?: string;
}) {
  const { colors, styles } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.choice,
        active && { backgroundColor: colors.active, borderColor: colors.green },
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          color={color ?? (active ? colors.green : colors.muted)}
        />
      )}
      <Text
        style={{
          color: active ? colors.green : colors.muted,
          fontSize: 13,
          fontWeight: "500",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panel: {
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 18,
    },
    section: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 28,
      marginBottom: 14,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: -0.4,
    },
    label: { color: colors.inputText, fontSize: 13, fontWeight: "500" },
    input: {
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      paddingHorizontal: 16,
      paddingVertical: 15,
      color: colors.text,
      fontSize: 16,
    },
    button: {
      backgroundColor: colors.green,
      borderRadius: 13,
      padding: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
    },
    buttonText: { fontWeight: "700", fontSize: 14 },
    secondary: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
    },
    empty: { alignItems: "center", paddingVertical: 22, gap: 12 },
    emptyIcon: {
      height: 66,
      width: 66,
      backgroundColor: colors.iconBg,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
    emptyDescription: {
      color: colors.muted,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 270,
      marginBottom: 5,
    },
    choice: {
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    title: { color: colors.text, fontSize: 16, fontWeight: "600" },
    muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    amount: { color: colors.text, fontSize: 17, fontWeight: "600" },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  });

export function useUI() {
  const theme = useTheme();
  return {
    ...theme,
    styles: React.useMemo(() => createStyles(theme.colors), [theme.colors]),
  };
}
