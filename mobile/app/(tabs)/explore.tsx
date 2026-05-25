import React from "react"
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import CardContainer from "../../components/CardContainer"
import DarkGradientBackground from "../../components/DarkGradientBackground"
import GlowButton from "../../components/GlowButton"
import { theme } from "../../constants/theme"

const HORIZONTAL_PAD = 24

const ExploreScreen = () => {
  const navigation = useNavigation<{ navigate: (name: "Book") => void }>()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()

  const brandFontSize = screenWidth < 340 ? 11 : screenWidth < 375 ? 12 : 13
  const brandLetterSpacing = screenWidth < 340 ? 0.6 : screenWidth < 375 ? 1 : 1.4

  return (
    <View style={styles.root}>
      <DarkGradientBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 16) + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text
            style={[
              styles.brand,
              { fontSize: brandFontSize, letterSpacing: brandLetterSpacing },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            IFCDC BARBERS
          </Text>
          <Text style={styles.tagline}>Cut. Style. Elevate.</Text>
        </View>

        <CardContainer style={styles.heroCard}>
          <Text style={styles.heroTitle}>Book Appointment</Text>
          <Text style={styles.heroCopy}>
            Choose your barber, pick a time, and pay securely with PayPal. You will receive a
            confirmation email when your booking is complete.
          </Text>
          <GlowButton label="Book Appointment →" onPress={() => navigation.navigate("Book")} />
        </CardContainer>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg0,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: HORIZONTAL_PAD,
    gap: 20,
  },
  headerBlock: {
    width: "100%",
    maxWidth: "100%",
    flexShrink: 1,
    gap: 6,
  },
  brand: {
    color: theme.colors.gold,
    fontWeight: "800",
    flexShrink: 1,
    width: "100%",
    maxWidth: "100%",
  },
  tagline: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: "500",
    flexShrink: 1,
  },
  heroCard: {
    padding: 28,
    marginTop: 12,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  heroCopy: {
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 22,
  },
})

export default ExploreScreen
