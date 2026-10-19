import React, { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Icon, useUI } from "./ui";

export type TransactionAction = {
  title: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function TransactionRow({
  title,
  subtitle,
  detail,
  amount,
  status,
  icon,
  iconColor,
  amountColor,
  statusColor,
  onPress,
  actions = [],
  openActionsOnPress = false,
}: {
  title: string;
  subtitle: string;
  detail?: string;
  amount: string;
  status: string;
  icon: string;
  iconColor: string;
  amountColor: string;
  statusColor: string;
  onPress: () => void;
  actions?: TransactionAction[];
  openActionsOnPress?: boolean;
}) {
  const { colors } = useUI();
  const { width, height } = useWindowDimensions();
  const anchor = useRef<View>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const menuWidth = Math.min(260, width - 32);
  const menuHeight = Math.min(actions.length * 52 + 58, height * 0.65);
  function openMenu() {
    anchor.current?.measureInWindow((x, y, w, h) => {
      const top = y + h + 6;
      setPosition({
        x: Math.max(16, Math.min(x + w - menuWidth, width - menuWidth - 16)),
        y: Math.max(24, Math.min(top, height - menuHeight - 24)),
      });
    });
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${amount}, ${status}`}
        onPress={openActionsOnPress && actions.length ? openMenu : onPress}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            width: "100%",
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            opacity: pressed ? 0.65 : 1,
          },
        ]}
      >
        <View
          style={{
            width: 36,
            height: 40,
            flexShrink: 0,
            borderRadius: 12,
            backgroundColor: `${iconColor}18`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} color={iconColor} size={20} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontSize: 14,
              fontWeight: "600",
              lineHeight: 20,
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={2}
            style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}
          >
            {subtitle}
          </Text>
          {!!detail && (
            <Text
              numberOfLines={1}
              style={{ color: colors.blue, fontSize: 11, lineHeight: 16 }}
            >
              {detail}
            </Text>
          )}
        </View>
        <View
          style={{
            flexShrink: 0,
            maxWidth: "42%",
            alignItems: "flex-end",
            gap: 3,
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={{
              color: amountColor,
              fontSize: 14,
              fontWeight: "600",
              lineHeight: 22,
            }}
          >
            {amount}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: statusColor, fontSize: 10, lineHeight: 18 }}>
              {status}
            </Text>
            {!!actions.length && (
              <View ref={anchor} collapsable={false}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ações de ${title}`}
                  accessibilityState={{ expanded: !!position }}
                  hitSlop={6}
                  onPress={(event) => {
                    event.stopPropagation();
                    openMenu();
                  }}
                  style={{ paddingHorizontal: 4, paddingVertical: 3 }}
                >
                  <Icon name="ellipsis-horizontal" size={18} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Pressable>
      <Modal
        visible={!!position}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPosition(null)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar menu de ações"
            onPress={() => setPosition(null)}
            style={StyleSheet.absoluteFill}
          />
          {position && (
            <View
              accessibilityRole="menu"
              style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                width: menuWidth,
                maxHeight: menuHeight,
                backgroundColor: colors.panel,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 8,
                elevation: 10,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  color: colors.muted,
                  fontSize: 12,
                }}
              >
                {title}
              </Text>
              <ScrollView>
                {actions.map((action) => (
                  <Pressable
                    key={action.title}
                    accessibilityRole="menuitem"
                    disabled={action.disabled}
                    onPress={() => {
                      setPosition(null);
                      action.onPress();
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      opacity: action.disabled ? 0.4 : 1,
                    }}
                  >
                    <Icon
                      name={action.icon}
                      color={action.danger ? colors.red : colors.text}
                      size={18}
                    />
                    <Text
                      style={{
                        color: action.danger ? colors.red : colors.text,
                        fontSize: 14,
                      }}
                    >
                      {action.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}
