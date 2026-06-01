import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import IFCDCFooter from "./IFCDCFooter";

type Props = {
  children: React.ReactNode;
  /** Show global IFCDC footer above bottom chrome. Default true. */
  showFooter?: boolean;
  style?: ViewStyle;
};

/**
 * Shared page shell — flex content + optional global footer.
 * Tab screens get the footer via HomeTabs custom tab bar; auth screens use this directly.
 */
export default function ScreenShell({ children, showFooter = true, style }: Props) {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.content}>{children}</View>
      {showFooter ? (
        <View style={styles.footerSlot}>
          <IFCDCFooter compact showPowered={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, minHeight: 0 },
  footerSlot: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(212,175,55,0.12)",
  },
});
