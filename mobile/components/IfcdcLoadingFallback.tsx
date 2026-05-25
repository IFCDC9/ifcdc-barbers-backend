import React from "react";
import { Text, View } from "react-native";

/** Visible debug fallback — always non-white background. */
export default function IfcdcLoadingFallback() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#050505",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "white" }}>IFCDC Loading...</Text>
    </View>
  );
}
