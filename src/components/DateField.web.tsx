import React from "react";
import { View, Text } from "react-native";
import { useUI } from "./ui";
import { formatBrazilianDate, parseBrazilianDate } from "../lib/dates";
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors, styles, mode } = useUI();
  return (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      <input
        aria-label={label}
        type="date"
        lang="pt-BR"
        min="1900-01-01"
        max="2100-12-31"
        value={parseBrazilianDate(value)}
        onChange={(event) => {
          const next = event.target.value;
          if (/^\d{4}-\d{2}-\d{2}$/.test(next))
            onChange(formatBrazilianDate(next));
        }}
        style={{
          padding: 15,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          color: colors.text,
          background: colors.panel,
          font: "inherit",
          colorScheme: mode,
          minHeight: 48,
          boxSizing: "border-box",
          width: "100%",
        }}
      />
    </View>
  );
}
