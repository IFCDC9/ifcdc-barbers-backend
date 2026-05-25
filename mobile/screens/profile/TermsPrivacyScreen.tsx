import React from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import { PRIVACY_URL, TERMS_URL } from "../../constants/legal";
import { theme } from "../../constants/theme";

function openUrl(url: string, label: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert(label, "This link will be available on our website soon.");
  });
}

export default function TermsPrivacyScreen() {
  return (
    <ProfileScreenLayout title="Terms & Privacy" subtitle="Legal information">
      <ProfileCard>
        <Text style={styles.body}>
          By using IFCDC Barbers you agree to our terms of service and privacy policy. We collect account
          and booking information to provide appointments, payments, and confirmations.
        </Text>
        <Text style={styles.body}>
          Payments are processed by PayPal. We do not store full payment card details on IFCDC servers.
        </Text>
      </ProfileCard>

      <ProfileCard style={styles.links}>
        <GlowButton label="View Terms of Service" onPress={() => openUrl(TERMS_URL, "Terms of Service")} />
        <GlowButton
          label="View Privacy Policy"
          onPress={() => openUrl(PRIVACY_URL, "Privacy Policy")}
          variant="outline"
        />
      </ProfileCard>

      <ProfileCard>
        <Text style={styles.embedTitle}>Summary</Text>
        <View style={styles.bullet}>
          <Text style={styles.bulletText}>• Bookings and profile data are used to run the service.</Text>
        </View>
        <View style={styles.bullet}>
          <Text style={styles.bulletText}>• Email confirmations are sent for completed PayPal bookings.</Text>
        </View>
        <View style={styles.bullet}>
          <Text style={styles.bulletText}>• SMS is not active until messaging is restored.</Text>
        </View>
        <Pressable onPress={() => openUrl(TERMS_URL, "Terms")}>
          <Text style={styles.link}>Full terms on ifcdcbarbersapp.com →</Text>
        </Pressable>
      </ProfileCard>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  body: { color: theme.colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  links: { gap: 12 },
  embedTitle: { color: theme.colors.gold, fontWeight: "800", fontSize: 14, marginBottom: 10 },
  bullet: { marginBottom: 8 },
  bulletText: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  link: { color: theme.colors.gold, marginTop: 12, fontWeight: "700" },
});
