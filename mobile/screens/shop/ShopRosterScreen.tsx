import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ShopRosterCard from "../../components/ShopRosterCard";
import ShopStaffGuard from "../../components/ShopStaffGuard";
import { fetchShopList, type ShopRow } from "../../services/shopStaffApi";
import { getMergedPlaceholderShops } from "../../services/shopPlaceholderStore";
import { theme } from "../../constants/theme";

export type ShopRosterNavParams = {
  ShopDetail: { businessId: string; shopName: string; isPlaceholder?: boolean };
};

function ShopRosterInner() {
  const navigation = useNavigation<StackNavigationProp<ShopRosterNavParams>>();
  const [rows, setRows] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchShopList();
      setRows(list.length > 0 ? list : await getMergedPlaceholderShops());
    } catch {
      setRows(await getMergedPlaceholderShops());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProfileScreenLayout
      title="Platform shops"
      subtitle="Manage platform businesses"
      headerTopPad={12}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.gold} style={styles.loader} />
      ) : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.muted}>No businesses available for your account.</Text>
      ) : null}
      <View style={styles.list}>
        {rows.map((row) => {
          const id = String(row.business_id);
          const name = row.name || `Shop ${id}`;
          const isPlaceholder = Boolean(
            row.isPlaceholder || String(row.business_id).startsWith("placeholder-"),
          );
          return (
            <ShopRosterCard
              key={id}
              shop={row}
              onPress={() =>
                navigation.navigate("ShopDetail", { businessId: id, shopName: name, isPlaceholder })
              }
            />
          );
        })}
      </View>
    </ProfileScreenLayout>
  );
}

export default function ShopRosterScreen() {
  return (
    <ShopStaffGuard>
      <ShopRosterInner />
    </ShopStaffGuard>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 32, marginBottom: 8 },
  list: { gap: 10 },
  muted: { color: theme.colors.textMuted, fontSize: 14, textAlign: "center" },
});
