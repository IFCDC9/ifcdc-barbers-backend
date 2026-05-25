import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import UserAvatar from "../../components/UserAvatar";
import UserManagementRouteGuard from "../../components/UserManagementRouteGuard";
import { useAuth } from "../../services/authContext";
import {
  fetchAdminUserById,
  formatUserRole,
  updateAdminUser,
  type AdminUserRow,
} from "../../services/adminUsersApi";
import { loadAdminUserAvatar } from "../../services/adminUserLocalStore";
import { fetchShopList, type ShopRow } from "../../services/shopStaffApi";
import { assignableRolesForActor, canEditUser } from "../../utils/userManagementAccess";
import { isSuperAdminUser } from "../../utils/adminAccess";
import { theme } from "../../constants/theme";
import { userFacingApiError } from "../../utils/userFacingApiError";
import type { UserDetailParams } from "./UserDetailScreen";

type EditRoute = RouteProp<{ EditUser: UserDetailParams }, "EditUser">;

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EditUserInner() {
  const navigation = useNavigation();
  const route = useRoute<EditRoute>();
  const { user: actor, token } = useAuth();
  const { userId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("user");
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [shops, setShops] = useState<ShopRow[]>([]);

  const roleOptions = useMemo(() => assignableRolesForActor(actor, token), [actor, token]);
  const superAdmin = isSuperAdminUser(actor, token);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [row, shopRows] = await Promise.all([fetchAdminUserById(userId), fetchShopList()]);
      setShops(shopRows);
      if (!row) return;
      if (!canEditUser(actor, token, row)) {
        Alert.alert("Access denied", "You cannot edit this account.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setUser(row);
      setName(row.name);
      setPhone(row.phone || "");
      setRole(row.role);
      setStatus(row.status);
      setBusinessId(row.businessId != null ? String(row.businessId) : null);
      setBusinessName(row.businessName || null);
      const local = await loadAdminUserAvatar(row.id);
      setAvatarUri(local || row.profileImageUrl || null);
    } finally {
      setLoading(false);
    }
  }, [actor, navigation, token, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shopOptions = useMemo(() => {
    if (superAdmin) return shops;
    const actorBiz = actor?.businessId;
    return shops.filter((s) => String(s.business_id) === String(actorBiz));
  }, [actor?.businessId, shops, superAdmin]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo access to choose a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const onSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert("Name required", "Enter a display name.");
      return;
    }
    setSaving(true);
    try {
      const selectedShop = shopOptions.find((s) => String(s.business_id) === String(businessId));
      const nextBusinessName = selectedShop?.name || businessName;
      await updateAdminUser(user.id, {
        name: name.trim(),
        phone: phone.replace(/\D/g, "") || null,
        role,
        status,
        businessId: businessId || null,
        businessName: nextBusinessName,
        localAvatarUri: avatarUri && avatarUri.startsWith("file:") ? avatarUri : undefined,
        profileImageUrl: avatarUri && !avatarUri.startsWith("file:") ? avatarUri : null,
      });
      Alert.alert("Saved", "User profile updated.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert("Save failed", userFacingApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProfileScreenLayout title="Edit user" subtitle="Platform users">
        <ActivityIndicator color={theme.colors.gold} style={styles.loader} />
      </ProfileScreenLayout>
    );
  }

  if (!user) {
    return (
      <ProfileScreenLayout title="Edit user" subtitle="Platform users">
        <Text style={styles.muted}>User not found.</Text>
      </ProfileScreenLayout>
    );
  }

  return (
    <ProfileScreenLayout title="Edit user" subtitle={user.email} headerTopPad={12}>
      <ProfileCard style={styles.card}>
        <Pressable onPress={pickPhoto} style={styles.avatarTap}>
          <UserAvatar name={name || user.name} email={user.email} uri={avatarUri} size={88} />
          <Text style={styles.changePhoto}>Upload / change photo</Text>
        </Pressable>

        <Text style={styles.label}>Display name</Text>
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

        <Text style={styles.label}>Email</Text>
        <Text style={styles.readOnly}>{user.email}</Text>

        <Text style={styles.label}>Role</Text>
        <View style={styles.chipRow}>
          {roleOptions.map((r) => (
            <Chip
              key={r}
              label={formatUserRole(r)}
              active={role === r}
              onPress={() => setRole(r)}
            />
          ))}
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.chipRow}>
          <Chip label="Active" active={status === "active"} onPress={() => setStatus("active")} />
          <Chip label="Disabled" active={status === "disabled"} onPress={() => setStatus("disabled")} />
        </View>

        <Text style={styles.label}>Shop / business</Text>
        <View style={styles.chipRow}>
          {superAdmin ? (
            <Chip
              label="None"
              active={!businessId}
              onPress={() => {
                setBusinessId(null);
                setBusinessName(null);
              }}
            />
          ) : null}
          {shopOptions.map((shop) => {
            const id = String(shop.business_id);
            const label = shop.name || `Shop ${id}`;
            return (
              <Chip
                key={id}
                label={label}
                active={businessId === id}
                onPress={() => {
                  setBusinessId(id);
                  setBusinessName(label);
                }}
              />
            );
          })}
        </View>
        {businessName ? <Text style={styles.hint}>Assigned: {businessName}</Text> : null}
      </ProfileCard>

      <GlowButton label={saving ? "Saving…" : "Save changes"} onPress={onSave} loading={saving} disabled={saving} />
    </ProfileScreenLayout>
  );
}

export default function EditUserScreen() {
  return (
    <UserManagementRouteGuard>
      <EditUserInner />
    </UserManagementRouteGuard>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 32 },
  muted: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center", marginTop: 24 },
  card: { gap: 10 },
  avatarTap: { alignItems: "center", marginBottom: 4 },
  changePhoto: { color: theme.colors.gold, marginTop: 8, fontWeight: "700", fontSize: 14 },
  label: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 4,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 16,
  },
  readOnly: { color: theme.colors.textMuted, fontSize: 16, paddingVertical: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipActive: {
    borderColor: theme.colors.gold,
    backgroundColor: "rgba(245,200,66,0.12)",
  },
  chipText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: theme.colors.gold },
  hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
});
