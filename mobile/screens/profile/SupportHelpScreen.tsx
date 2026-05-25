import React from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import { SUPPORT_EMAIL } from "../../constants/legal";
import { theme } from "../../constants/theme";

const FAQ = [
  {
    q: "How do I book an appointment?",
    a: "From Explore, tap Book Appointment, choose your barber, date, and time, then complete checkout with PayPal.",
  },
  {
    q: "Will I get a confirmation email?",
    a: "Yes — after PayPal payment is confirmed, you should receive a booking confirmation email.",
  },
  {
    q: "What is AURA?",
    a: "AURA is IFCDC’s in-app text assistant. Tap the glowing AURA button to ask questions about bookings and services.",
  },
  {
    q: "Can I change or cancel a booking in the app?",
    a: "Contact support or your barber shop for changes. In-app rescheduling is managed through your shop administrator.",
  },
];

export default function SupportHelpScreen() {
  const mailSupport = () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("IFCDC Barbers app support")}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Contact support", SUPPORT_EMAIL);
    });
  };

  const reportIssue = () => {
    Alert.alert(
      "Report an issue",
      "Describe what happened and include your booking email if relevant. Our team will follow up by email.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Email support", onPress: mailSupport },
      ],
    );
  };

  return (
    <ProfileScreenLayout title="Support / Help" subtitle="Answers and contact options">
      <ProfileCard>
        <Text style={styles.section}>FAQ</Text>
        {FAQ.map((item) => (
          <View key={item.q} style={styles.faqItem}>
            <Text style={styles.faqQ}>{item.q}</Text>
            <Text style={styles.faqA}>{item.a}</Text>
          </View>
        ))}
      </ProfileCard>

      <ProfileCard style={styles.actions}>
        <GlowButton label="Contact support" onPress={mailSupport} />
        <GlowButton label="Report an app issue" onPress={reportIssue} variant="outline" />
        <Pressable onPress={() => Alert.alert("AURA", "Tap the AURA button on any tab for text help.")}>
          <Text style={styles.auraHint}>Need quick answers? Use the AURA text assistant on any screen.</Text>
        </Pressable>
      </ProfileCard>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  section: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  faqItem: { marginBottom: 16 },
  faqQ: { color: theme.colors.text, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  faqA: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  actions: { gap: 12 },
  auraHint: { color: theme.colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 4 },
});
