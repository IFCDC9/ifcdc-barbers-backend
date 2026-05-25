import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput } from "react-native";
import { UX } from "../../utils/uxCopy";
import { ScreenLoading } from "../../components/LoadingState";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import ShopStaffGuard from "../../components/ShopStaffGuard";
import { fetchShopDetail, saveShopDetail } from "../../services/shopStaffApi";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { theme } from "../../constants/theme";
import type { ShopDetailParams } from "./ShopDetailScreen";

type EditRoute = RouteProp<{ ShopEdit: ShopDetailParams }, "ShopEdit">;

function ShopEditInner() {
  const navigation = useNavigation();
  const route = useRoute<EditRoute>();
  const { businessId, shopName, isPlaceholder: isPlaceholderParam } = route.params;
  const isPlaceholder =
    isPlaceholderParam ?? String(businessId).startsWith("placeholder-");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(shopName);
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const shop = await fetchShopDetail(businessId);
      if (shop) {
        setName(shop.name || shopName);
        setPhone(shop.phone || "");
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, shopName]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter a shop name.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveShopDetail(businessId, { name: name.trim(), phone: phone || null });
      const message = result.savedLocally
        ? "Shop saved on this device. Changes will sync when the shop is connected to the platform."
        : "Shop updated.";
      Alert.alert("Saved", message, [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) {
      const message = userFacingApiError(e);
      Alert.alert("Save failed", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileScreenLayout title="Edit Shop" subtitle={shopName}>
      {isPlaceholder ? (
        <Text style={styles.previewNote}>{UX.offlineShopNote}</Text>
      ) : null}
      {loading ? <ScreenLoading /> : null}
      {!loading ? (
        <>
          <ProfileCard style={styles.form}>
            <Text style={styles.label}>Shop name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholderTextColor="rgba(255,255,255,0.35)"
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              keyboardType="phone-pad"
              placeholderTextColor="rgba(255,255,255,0.35)"
            />
          </ProfileCard>
          <GlowButton label={saving ? "Saving…" : "Save shop"} onPress={onSave} disabled={saving} loading={saving} />
        </>
      ) : null}
    </ProfileScreenLayout>
  );
}

export default function ShopEditScreen() {
  return (
    <ShopStaffGuard>
      <ShopEditInner />
    </ShopStaffGuard>
  );
}

const styles = StyleSheet.create({
  previewNote: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  form: { gap: 8 },
  label: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 4 },
  input: {
    color: theme.colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
