import React from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import ContactShopCard from "../../components/ContactShopCard"
import CardContainer from "../../components/CardContainer"
import GlowButton from "../../components/GlowButton"
import LiveSupabaseDashboard from "../../components/LiveSupabaseDashboard"
import { theme } from "../../constants/theme"
import { startListeningOnce, voiceTurnFromTextAsync } from "../../services/voiceService"
import { Alert } from "react-native"

const ExploreScreen = () => {
  const navigation = useNavigation<{ navigate: (name: "Book") => void }>()
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.brand}>IFCDC BARBER</Text>
      <Text style={styles.tagline}>Cut. Style. Elevate.</Text>

      <CardContainer glow style={styles.heroCard}>
        <Text style={styles.heroTitle}>Book Appointment</Text>
        <Text style={styles.heroCopy}>
          Reserve your chair, choose your service, and check out securely.
        </Text>
        <GlowButton label="Book Appointment →" onPress={() => navigation.navigate("Book")} />
      </CardContainer>

      <CardContainer glow style={styles.voiceCard}>
        <Text style={styles.voiceTitle}>Voice Assistant (beta)</Text>
        <Text style={styles.voiceCopy}>
          Tap to speak. On Expo Go, speech recognition may require a dev build.
        </Text>
        <GlowButton
          label="Start voice"
          onPress={async () => {
            try {
              const transcript = await startListeningOnce()
              const result = await voiceTurnFromTextAsync(transcript)
              if (!result.ok) {
                Alert.alert("Voice", result.error)
                return
              }
              Alert.alert("Voice", result.replyText)
            } catch (e) {
              Alert.alert("Voice", e instanceof Error ? e.message : String(e))
            }
          }}
        />
      </CardContainer>

      <LiveSupabaseDashboard />

      <ContactShopCard />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.bg0,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 24,
  },
  brand: {
    color: theme.colors.gold,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 4,
    marginTop: 8,
    alignSelf: "flex-start",
    paddingRight: 8,
  },
  tagline: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 8,
  },
  heroCard: {
    padding: 22,
  },
  voiceCard: {
    padding: 22,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  heroCopy: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  voiceTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  voiceCopy: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
})

export default ExploreScreen
