import React from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import ContactShopCard from "../../components/ContactShopCard"

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

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Book Appointment</Text>
        <Text style={styles.heroCopy}>
          Reserve your chair, choose your service, and check out securely.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => navigation.navigate("Book")}
          android_ripple={{ color: "rgba(245,200,66,0.35)" }}
        >
          <Text style={styles.ctaText}>Book Appointment →</Text>
        </Pressable>
      </View>

      <ContactShopCard />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#050505",
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 24,
  },
  brand: {
    color: "#f5c842",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 4,
    marginTop: 8,
    alignSelf: "flex-start",
    paddingRight: 8,
  },
  tagline: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 8,
  },
  heroCard: {
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.28)",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  heroCopy: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  cta: {
    backgroundColor: "#f5c842",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
})

export default ExploreScreen
