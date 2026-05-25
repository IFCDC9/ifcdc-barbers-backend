import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import BookingHistoryScreen from "./profile/BookingHistoryScreen";
import BookingDetailScreen from "./profile/BookingDetailScreen";
import CancelBookingScreen from "./profile/CancelBookingScreen";
import RescheduleBookingScreen from "./profile/RescheduleBookingScreen";

export type AppointmentsStackParamList = {
  AppointmentsHome: undefined;
  BookingDetail: { bookingId: string };
  CancelBooking: { bookingId: string };
  RescheduleBooking: { bookingId: string };
};

const Stack = createStackNavigator<AppointmentsStackParamList>();

function AppointmentsHome() {
  return <BookingHistoryScreen standalone />;
}

/** Tab-root appointments stack — list + drill-down detail. */
export default function AppointmentsScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AppointmentsHome" component={AppointmentsHome} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <Stack.Screen name="CancelBooking" component={CancelBookingScreen} />
      <Stack.Screen name="RescheduleBooking" component={RescheduleBookingScreen} />
    </Stack.Navigator>
  );
}
