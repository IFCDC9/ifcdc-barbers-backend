import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import UserAvatar from "../../components/UserAvatar";
import UserManagementRouteGuard from "../../components/UserManagementRouteGuard";
import { useAuth } from "../../services/authContext";
import {
  fetchAdminUserById,
  formatUserDate,
  formatUserRole,
  updateAdminUser,
  type AdminUserRow,
} from "../../services/adminUsersApi";
import { loadAdminUserAvatar } from "../../services/adminUserLocalStore";
import { canEditUser } from "../../utils/userManagementAccess";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { theme } from "../../constants/theme";

export type UserDetailParams = { userId: string };

type DetailRoute = RouteProp<{ UserDetail: UserDetailParams }, "UserDetail">;

import type { AdminStackParamList } from "../../navigation/AdminStack";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function UserDetailInner() {
  const navigation = useNavigation<StackNavigationProp<AdminStackParamList>>();
  const route = useRoute<DetailRoute>();
  const { user: actor, token } = useAuth();
  const { userId } = route.params;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await fetchAdminUserById(userId);
      setUser(row);
      if (row) {
        const local = await loadAdminUserAvatar(row.id);
        setAvatarUri(local || row.profileImageUrl || null);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const editable = user ? canEditUser(actor, token, user) : false;

  const pickPhoto = async () => {
    if (!user || !editable) return;
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
    if (result.canceled || !result.assets[0]?.uri) return;

    setBusy(true);
    try {
      const uri = result.assets[0].uri;
      const updated = await updateAdminUser(user.id, { localAvatarUri: uri });
      setUser(updated);
      setAvatarUri(uri);
      Alert.alert("Photo saved", "Profile photo updated on this device.");
    } catch (e) {
      Alert.alert("Photo failed", userFacingApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!user || !editable) return;
    const next = user.status === "disabled" ? "active" : "disabled";
  const label = next === "disabled" ? "disable" : "enable";
    Alert.alert(`${next === "disabled" ? "Disable" : "Enable"} user`, `Are you sure you want to ${label} ${user.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: next === "disabled" ? "destructive" : "default",
        onPress: async () => {
          setBusy(true);
          try {
            const updated = await updateAdminUser(user.id, { status: next });
            setUser(updated);
          } catch (e) {
            Alert.alert("Update failed", userFacingApiError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ProfileScreenLayout title="User detail" subtitle="Platform users">
        <ActivityIndicator color={theme.colors.gold} style={styles.loader} />
      </ProfileScreenLayout>
    );
  }

  if (!user) {
    return (
      <ProfileScreenLayout title="User detail" subtitle="Platform users">
        <Text style={styles.muted}>User not found.</Text>
      </ProfileScreenLayout>
    );
  }

  const business =
    user.businessName ||
    (user.businessId != null && user.businessId !== "" ? `Business #${user.businessId}` : "None");

  return (
    <ProfileScreenLayout title="User detail" subtitle="Platform users" headerTopPad={12}>
      <ProfileCard style={styles.hero}>
        <Pressable onPress={editable ? pickPhoto : undefined} style={styles.avatarWrap}>
          <UserAvatar name={user.name} email={user.email} uri={avatarUri} size={96} />
          {editable ? <Text style={styles.changePhoto}>Upload / change photo</Text> : null}
        </Pressable>
        <Text style={styles.name}>{user.name}</Text>
      </ProfileCard>

      <ProfileCard style={styles.card}>
        <MetaRow label="Email" value={user.email} />
        <MetaRow label="Role" value={formatUserRole(user.role)} />
        <MetaRow label="Status" value={user.status === "disabled" ? "Disabled" : "Active"} />
        <MetaRow label="Shop / business" value={business} />
        <MetaRow label="Phone" value={user.phone || "—"} />
        <MetaRow label="Created" value={formatUserDate(user.createdAt)} />
        <MetaRow label="Last login" value={user.lastLogin ? formatUserDate(user.lastLogin) : "—"} />
      </ProfileCard>

      <View style={styles.actions}>
        {editable ? (
          <>
            <GlowButton
              label="Edit User"
              onPress={() => navigation.navigate("EditUser", { userId: user.id })}
              disabled={busy}
            />
            <GlowButton
              label="Upload / Change Photo"
              variant="outline"
              onPress={pickPhoto}
              disabled={busy}
              loading={busy}
            />
            <GlowButton
              label="Change Role"
              variant="outline"
              onPress={() => navigation.navigate("EditUser", { userId: user.id })}
              disabled={busy}
            />
            <GlowButton
              label="Assign Shop"
              variant="outline"
              onPress={() => navigation.navigate("EditUser", { userId: user.id })}
              disabled={busy}
            />
            <GlowButton
              label={user.status === "disabled" ? "Enable User" : "Disable User"}
              variant="outline"
              onPress={toggleStatus}
              disabled={busy}
            />
          </>
        ) : null}
        <GlowButton
          label="Reset Password"
          variant="outline"
          onPress={() => navigation.navigate("ResetUserPasswordScreen", { userId: user.id })}
          disabled={busy}
        />
        <GlowButton
          label="View Activity"
          variant="outline"
          onPress={() =>
            navigation.navigate("AdminAccessAuditScreen", {
              initialSearch: user.email || user.name,
            })
          }
          disabled={busy}
        />
      </View>
    </ProfileScreenLayout>
  );
}

export default function UserDetailScreen() {
  return (
    <UserManagementRouteGuard>
      <UserDetailInner />
    </UserManagementRouteGuard>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 32 },
  muted: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center", marginTop: 24 },
  hero: { alignItems: "center", gap: 10, paddingVertical: 18 },
  avatarWrap: { alignItems: "center", gap: 8 },
  changePhoto: { color: theme.colors.gold, fontSize: 13, fontWeight: "700" },
  name: { color: theme.colors.gold, fontSize: 22, fontWeight: "800" },
  card: { gap: 2 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  metaLabel: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
  metaValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    maxWidth: "58%",
    textAlign: "right",
  },
  actions: { gap: 10, marginTop: 4 },
});
