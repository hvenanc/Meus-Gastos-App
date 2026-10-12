import { formatBrazilianDate } from "./dates";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Data, today, validateData } from "./finance";
export async function exportBackup(data: Data) {
  const content = JSON.stringify(data, null, 2),
    name = `meus-gastos-${formatBrazilianDate(today()).replace(/\//g, "-")}.json`;
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(content);
    if (await Sharing.isAvailableAsync())
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Salvar backup",
      });
    else throw new Error("Compartilhamento indisponível neste aparelho.");
  }
}
export async function importBackup(): Promise<Data | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 10_000_000)
    throw new Error("O backup deve ter até 10 MB.");
  const text =
    Platform.OS === "web"
      ? await (asset.file as globalThis.File).text()
      : await new File(asset.uri).text();
  const parsed: unknown = JSON.parse(text);
  if (!validateData(parsed))
    throw new Error("Backup inválido ou incompatível com esta versão.");
  return parsed;
}
