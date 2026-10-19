import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getBank, searchBanks } from "../data/banks";
import { BankIcon, Button, Field, useUI } from "./ui";

const PAGE_SIZE = 24;

export function BankPicker({
  value,
  onChange,
  includeWallet = true,
}: {
  value: string;
  onChange: (id: string) => void;
  includeWallet?: boolean;
}) {
  const { colors, styles } = useUI();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const matches = searchBanks(query, includeWallet);
  const visible = matches.slice(0, limit);
  const selected = getBank(value);
  // Keep the saved selection visible when opening an existing account.
  if (!query.trim() && !visible.some((bank) => bank.id === selected.id)) {
    visible.unshift(selected);
  }

  return (
    <View style={{ marginBottom: 20, gap: 10 }}>
      <Text style={styles.label}>Banco / instituição</Text>
      <Field
        label="Buscar banco"
        value={query}
        onChange={(text) => {
          setQuery(text);
          setLimit(PAGE_SIZE);
        }}
        placeholder="Nome, sigla ou instituição…"
      />
      <Text style={styles.muted}>
        Selecionado: {selected.name} ·{" "}
        {matches.filter((bank) => bank.id !== "other").length} instituições
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {visible.map((bank) => (
          <Pressable
            key={bank.id}
            accessibilityRole="button"
            accessibilityLabel={bank.name}
            accessibilityState={{ selected: selected.id === bank.id }}
            onPress={() => onChange(bank.id)}
            style={{
              width: "31%",
              padding: 12,
              gap: 8,
              alignItems: "center",
              backgroundColor:
                selected.id === bank.id ? colors.active : colors.panel,
              borderWidth: 1,
              borderColor:
                selected.id === bank.id ? colors.green : colors.border,
              borderRadius: 12,
            }}
          >
            <BankIcon bank={bank.id} size={34} />
            <Text
              numberOfLines={2}
              style={{ fontSize: 11, color: colors.text, textAlign: "center" }}
            >
              {bank.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {matches.every((bank) => bank.id === "other") && (
        <Text style={styles.muted}>
          Nenhuma instituição encontrada. Você pode usar Outro banco.
        </Text>
      )}
      {matches.length > limit && (
        <Button
          secondary
          title={`Mostrar mais (${matches.length - limit})`}
          onPress={() => setLimit((current) => current + PAGE_SIZE)}
        />
      )}
    </View>
  );
}
