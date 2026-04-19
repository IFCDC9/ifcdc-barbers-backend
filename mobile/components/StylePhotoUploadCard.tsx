import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_STORAGE_BUCKET } from "../constants/config";
import { theme } from "../constants/theme";
import GlowButton from "./GlowButton";

function slug(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

type Props = {
  supabase: SupabaseClient;
  onUploaded?: () => void;
};

export default function StylePhotoUploadCard({ supabase, onUploaded }: Props) {
  const [barberName, setBarberName] = useState("");
  const [styleName, setStyleName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [busy, setBusy] = useState(false);

  const pickAndUpload = async () => {
    const b = barberName.trim();
    const st = styleName.trim();
    const pr = Number(price);
    const dur = Math.floor(Number(duration) || 30);

    if (!b || !st) {
      Alert.alert("Photos", "Barber name and style name are required.");
      return;
    }
    if (!Number.isFinite(pr) || pr < 0) {
      Alert.alert("Photos", "Enter a valid price.");
      return;
    }
    if (dur < 1 || dur > 480) {
      Alert.alert("Photos", "Duration must be 1–480 minutes.");
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Photo library permission is required.");
      return;
    }

    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });

    if (pick.canceled || !pick.assets?.[0]?.uri) {
      return;
    }

    const asset = pick.assets[0];
    const uri = asset.uri;
    const lower = uri.toLowerCase();
    const mime = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";

    setBusy(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user?.id) {
        throw new Error(userErr?.message || "Not signed in to Supabase");
      }
      const uid = userData.user.id;

      const res = await fetch(uri);
      const buf = await res.arrayBuffer();
      const path = `${uid}/${Date.now()}-${slug(st)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(path, buf, { contentType: mime, upsert: false });

      if (upErr) {
        throw new Error(upErr.message);
      }

      const { data: pub } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
      const imageUrl = pub?.publicUrl;
      if (!imageUrl) {
        throw new Error("Could not resolve public URL");
      }

      const { error: insErr } = await supabase.from("barber_style_photos").insert({
        barber_name: b,
        style_name: st,
        price: pr,
        duration_minutes: dur,
        image_url: imageUrl,
        tags: [],
      });

      if (insErr) {
        throw new Error(insErr.message);
      }

      setStyleName("");
      setPrice("");
      onUploaded?.();
      Alert.alert("Photos", "Style photo uploaded.");
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Upload style photo (Supabase Storage + row)</Text>
      <Text style={styles.hint}>
        Files go to bucket `{SUPABASE_STORAGE_BUCKET}` under your Supabase user id. Requires authenticated session
        (app JWT bridge or anonymous).
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Barber name"
        placeholderTextColor={theme.colors.textMuted}
        value={barberName}
        onChangeText={setBarberName}
      />
      <TextInput
        style={styles.input}
        placeholder="Style name"
        placeholderTextColor={theme.colors.textMuted}
        value={styleName}
        onChangeText={setStyleName}
      />
      <TextInput
        style={styles.input}
        placeholder="Price (USD)"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
      />
      <TextInput
        style={styles.input}
        placeholder="Duration (minutes)"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="number-pad"
        value={duration}
        onChangeText={setDuration}
      />
      <GlowButton label={busy ? "Uploading…" : "Choose photo & upload"} loading={busy} onPress={() => void pickAndUpload()} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, marginTop: 6 },
  label: { color: theme.colors.text, fontWeight: "700", fontSize: 14 },
  hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 15,
  },
});
