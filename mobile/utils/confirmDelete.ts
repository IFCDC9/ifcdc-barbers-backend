import { Alert } from "react-native";

/** Standard destructive confirmation copy used across the app. */
export function confirmDelete(message?: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert("Delete", message ?? "Are you sure you want to delete this?", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
