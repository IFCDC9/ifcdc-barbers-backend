import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../services/authContext";
import { canManageSchedules } from "../../utils/scheduleAccess";
import { canManageShops } from "../../utils/shopAccess";
import { canAccessUserManagement } from "../../utils/userManagementAccess";
import ProfileCard from "../../components/ProfileCard";
import ProfileAmbientBackground from "../../components/ProfileAmbientBackground";
import GlowButton from "../../components/GlowButton";
import { profileHomeBottomPad } from "../../constants/profileLayout";
import { theme } from "../../constants/theme";
import type { ProfileStackParamList } from "../../navigation/ProfileStack";

function initialsFrom(name: string, email: string): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = email.trim();
  return e.length >= 2 ? e.slice(0, 2).toUpperCase() : "IF";
}

export default function ProfileHomeScreen() {
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();
  const { user, loading, signOut, token } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPad = profileHomeBottomPad(insets.bottom);

  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(`ifcdc_profile_avatar_${user.id}`).then((uri) => {
      if (uri) setLocalAvatar(uri);
    });
  }, [user?.id]);

  const displayName = loading ? "…" : user?.name || "IFCDC Member";
  const displayEmail = loading ? "Loading…" : user?.email || "—";
  const avatarLetters = initialsFrom(user?.name || "", user?.email || "");
  const avatarUri = localAvatar || user?.profileImageUrl || null;

  const menu: { key: keyof ProfileStackParamList; label: string }[] = [
    { key: "EditProfile", label: "Edit Profile" },
    { key: "BookingHistory", label: "Booking History" },
    ...(canManageShops(user, token)
      ? [{ key: "ShopRoster" as const, label: "Platform Shops" }]
      : []),
    ...(canManageSchedules(user, token)
      ? [
          { key: "BarberRoster" as const, label: "Barber Roster" },
          { key: "ScheduleControls" as const, label: "Schedule Controls" },
        ]
      : []),
    ...(canAccessUserManagement(user, token)
      ? [{ key: "ViewAllUsers" as const, label: "User Management" }]
      : []),
    { key: "Notifications", label: "Notifications" },
    { key: "PaymentMethods", label: "Payment Methods" },
    { key: "SupportHelp", label: "Support / Help" },
    { key: "LegalPolicies", label: "Legal & Policies" },
  ];

  return (
    <View style={styles.root}>
      <ProfileAmbientBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Profile</Text>
        <Text style={styles.screenSub}>Your account</Text>

        <ProfileCard style={styles.headerCard}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarLetters}</Text>
              </View>
            </View>
          )}
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>
        </ProfileCard>

        <ProfileCard style={styles.menuCard}>
          {menu.map((item, index) => (
            <Pressable
              key={item.key}
              onPress={() => navigation.navigate(item.key)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.menuRow,
                index < menu.length - 1 && styles.menuRowBorder,
                pressed && styles.menuRowPressed,
              ]}
            >
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </Pressable>
          ))}
        </ProfileCard>

        <ProfileCard style={styles.signOutCard}>
          <GlowButton
            label="Sign Out"
            variant="outline"
            onPress={() => {
              Alert.alert("Sign out?", "You can sign back in anytime.", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign Out", style: "destructive", onPress: () => signOut() },
              ]);
            }}
          />
        </ProfileCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg0 },
  scroll: { flex: 1, zIndex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, gap: 20 },
  screenTitle: { fontSize: 28, fontWeight: "800", color: theme.colors.text },
  screenSub: { color: theme.colors.textMuted, fontSize: 15, marginTop: -12, marginBottom: 4 },
  headerCard: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20 },
  avatarRing: {
    padding: 3,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.bg1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 78,
    height: 78,
    borderRadius: 39,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  avatarText: { color: theme.colors.gold, fontSize: 22, fontWeight: "900" },
  userName: { color: theme.colors.text, fontSize: 22, fontWeight: "800", marginBottom: 6 },
  userEmail: { color: theme.colors.textMuted, fontSize: 15 },
  menuCard: { paddingVertical: 4, paddingHorizontal: 0 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  menuRowPressed: { backgroundColor: "rgba(245,200,66,0.06)" },
  menuLabel: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  menuChevron: { color: theme.colors.gold, fontSize: 22, fontWeight: "300" },
  signOutCard: { marginTop: 4 },
});
