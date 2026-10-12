import React from "react";
import { Field } from "./ui";
import { maskMoney } from "../lib/moneyMask";
export function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChange={(text) => onChange(maskMoney(text))}
      keyboard="number-pad"
      placeholder="0,00"
    />
  );
}
