import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import StaffRosterGuard from "../../components/StaffRosterGuard";
import { fetchBarberProfile, saveBarberProfile } from "../../services/barberStaffApi";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { ScreenLoading } from "../../components/LoadingState";
import { theme } from "../../constants/theme";
import type { BarberDetailParams } from "./BarberDetailScreen";

type EditRoute = RouteProp<{ BarberEdit: BarberDetailParams }, "BarberEdit">;

function BarberEditInner() {
  const navigation = useNavigation();
  const route = useRoute<EditRoute>();
  const { barberId, barberName } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(barberName);
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await fetchBarberProfile(barberId);
      if (p) {
        setName(p.name || barberName);
        setPhone(p.phone || "");
        setBio(p.bio || "");
        setLocation(p.location || "");
      }
    } finally {
      setLoading(false);
    }
  }, [barberId, barberName]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveBarberProfile(barberId, { name, phone, bio, location });
      Alert.alert("Saved", "Barber profile updated.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert("Save failed", userFacingApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileScreenLayout title="Edit Barber" subtitle={barberName}>
      {loading ? <ScreenLoading /> : null}
      {!loading ? (
        <>
          <ProfileCard style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor="rgba(255,255,255,0.35)" />
            <Text style={styles.label}>Phone</Text>
            <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" placeholderTextColor="rgba(255,255,255,0.35)" />
            <Text style={styles.label}>Location</Text>
            <TextInput value={location} onChangeText={setLocation} style={styles.input} placeholderTextColor="rgba(255,255,255,0.35)" />
            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              style={[styles.input, styles.bio]}
              multiline
              placeholderTextColor="rgba(255,255,255,0.35)"
            />
          </ProfileCard>
          <GlowButton label={saving ? "Saving…" : "Save"} onPress={onSave} disabled={saving} loading={saving} />
        </>
      ) : null}
    </ProfileScreenLayout>
  );
}

export default function BarberEditScreen() {
  return (
    <StaffRosterGuard>
      <BarberEditInner />
    </StaffRosterGuard>
  );
}

const styles = StyleSheet.create({
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
  bio: { minHeight: 88, textAlignVertical: "top" },
});
