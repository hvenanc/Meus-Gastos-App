import React, { useState } from "react";
import { Modal, View, Pressable, Text, Platform } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Button, Icon, useUI } from "./ui";
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
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(new Date());
  const selected = () => new Date(`${parseBrazilianDate(value)}T12:00:00`);
  const format = (date: Date) =>
    formatBrazilianDate(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    );
  function show() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: selected(),
        mode: "date",
        display: "calendar",
        minimumDate: new Date(1900, 0, 1),
        maximumDate: new Date(2100, 11, 31),
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(format(date));
        },
      });
    } else {
      setDraft(selected());
      setOpen(true);
    }
  }
  return (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Selecionar data: ${value}`}
        onPress={show}
        style={[
          styles.input,
          {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: colors.text }}>{value}</Text>
        <Icon name="calendar-outline" color={colors.green} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "#0008",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.panel,
              padding: 20,
              borderRadius: 20,
              gap: 16,
            }}
          >
            <Text style={styles.title}>Selecionar data</Text>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              locale="pt-BR"
              themeVariant={mode}
              minimumDate={new Date(1900, 0, 1)}
              maximumDate={new Date(2100, 11, 31)}
              onChange={(_, date) => {
                if (date) setDraft(date);
              }}
            />
            <Button
              title="Confirmar data"
              onPress={() => {
                onChange(format(draft));
                setOpen(false);
              }}
            />
            <Button title="Cancelar" secondary onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
