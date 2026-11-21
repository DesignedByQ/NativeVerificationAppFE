import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar, StatusBarStyle } from "expo-status-bar";

type ApiResponse = {
  sessionUser?: string;
  sessionId?: string;
  otpVerified?: boolean | string;
  message?: string;
};

type RootStackParamList = {
  Home: undefined;
  OTPs: { dataReturned?: ApiResponse } | undefined;
  UserProfilePage: { dataReturned?: ApiResponse } | undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "OTPs">;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "http://10.0.2.2:8080/nativeverificationappbe";

  const statusBarStyle: StatusBarStyle = "light";

export default function OTPs({ navigation, route }: Props) {
  const dataReturned = route.params?.dataReturned;

  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  
  // Added state to track phone OTP verification status
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    if (!dataReturned) return;

    const triggerOTP = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/newuser/otp`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          console.error("OTP generation failed:", response.status);
          Alert.alert(
            "OTP notification",
            "We couldn't trigger OTP generation. Please try again."
          );
          return;
        }

        const result = await response.json();
        console.log("OTP generation request completed:", result.message);
      } catch (error) {
        console.error("Error triggering OTP:", error);
        Alert.alert(
          "Connection error",
          "Unable to contact the server to generate your OTPs."
        );
      }
    };

    triggerOTP();
  }, [dataReturned]);

  const handlePhoneOTPSubmit = async () => {
    if (!phoneOtp.trim()) {
      Alert.alert("Missing OTP", "Please enter your phone OTP.");
      return;
    }

    setPhoneLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/newuser/phoneotp`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ otp: phoneOtp.trim() }),
        }
      );

      if (!response.ok) {
        Alert.alert(
          "Verification failed",
          `Phone OTP verification failed (HTTP ${response.status}).`
        );
        return;
      }

      const result = await response.json();

      if (result === true || result?.otpVerified === true) {
        // Trigger alert first, then clear, disable, and update placeholder
        Alert.alert("Success", "Phone OTP verified successfully!", [
          {
            text: "OK",
            onPress: () => {
              setPhoneVerified(true);
              setPhoneOtp("");
            },
          },
        ]);
      } else {
        Alert.alert(
          "Verification failed",
          result?.message || "The phone OTP could not be verified."
        );
      }
    } catch (error) {
      console.error("Phone OTP error:", error);
      Alert.alert("Connection error", "Unable to verify your phone OTP.");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleEmailOTPSubmit = async () => {
    if (!emailOtp.trim()) {
      Alert.alert("Missing OTP", "Please enter your email OTP.");
      return;
    }

    setEmailLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/newuser/emailotp`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ otp: emailOtp.trim() }),
        }
      );

      if (!response.ok) {
        Alert.alert(
          "Verification failed",
          `Email OTP verification failed (HTTP ${response.status}).`
        );
        return;
      }

      const result = await response.json();

      const verified =
        result === true ||
        result?.otpVerified === true ||
        result?.otpVerified === "true";

      if (verified) {
        Alert.alert("Success", "Email OTP verified successfully!", [
          {
            text: "Continue",
            onPress: () =>
              navigation.navigate("UserProfilePage", {
                dataReturned,
              }),
          },
        ]);
      } else {
        Alert.alert(
          "Verification failed",
          result?.message || "The email OTP could not be verified."
        );
      }
    } catch (error) {
      console.error("Email OTP error:", error);
      Alert.alert("Connection error", "Unable to verify your email OTP.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync("user_id");
      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Unable to log out. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >

        <StatusBar style={statusBarStyle} />

        {/* Header Banner */}
        <View style={styles.header}>
            <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>CVT</Text>
            </View>
            <Text style={styles.headerTitle}>Check Verify Trust</Text>
            
        </View>

          <Text style={styles.description}>
            Verify your phone number and email address to continue.
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Phone verification</Text>

            <TextInput
              style={[styles.input, phoneVerified && styles.disabledInput]}
              placeholder={phoneVerified ? "Submitted" : "Enter Phone OTP"}
              placeholderTextColor="#777777"
              value={phoneOtp}
              onChangeText={setPhoneOtp}
              keyboardType="number-pad"
              maxLength={8}
              accessibilityLabel="Phone OTP"
              returnKeyType="done"
              editable={!phoneVerified}
            />

            <TouchableOpacity
              style={[
                styles.actionButton,
                (phoneLoading || phoneVerified) && styles.disabledButton,
              ]}
              onPress={handlePhoneOTPSubmit}
              disabled={phoneLoading || phoneVerified}
              accessibilityRole="button"
            >
              {phoneLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>
                  {phoneVerified ? "Verified" : "Verify Phone"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Email verification</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter Email OTP"
              placeholderTextColor="#777777"
              value={emailOtp}
              onChangeText={setEmailOtp}
              keyboardType="number-pad"
              maxLength={8}
              accessibilityLabel="Email OTP"
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[
                styles.actionButton,
                emailLoading && styles.disabledButton,
              ]}
              onPress={handleEmailOTPSubmit}
              disabled={emailLoading}
              accessibilityRole="button"
            >
              {emailLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>Verify Email</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.laterText}>Verify another time.</Text>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#A2C5B3",
    fontSize: 13,
    marginTop: 4,
  },
  logoBadge: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#008751",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
  },
  logoBadgeText: {
        color: "#FFF",
        fontWeight: "bold",
        fontSize: 20,
  },
  container: {
    flex: 1,
    backgroundColor: "#0A2E1D", // Nigerian Identity Dark Green theme
  },
  header: {
    alignItems: "center",
    paddingTop: 30,
    paddingBottom: 20,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#176B45",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 32,
  },
  logoCard: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginBottom: 30,
    elevation: 4,
  },
  logoText: {
    color: "#176B45",
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
  },
  heading: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    color: "#E5F2EA",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 21,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#FFFFFF",
    color: "#222222",
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#D9E5DD",
    marginBottom: 12,
  },
  disabledInput: {
    backgroundColor: "#EFEFEF", // Optional: slightly dim background for disabled look
  },
  actionButton: {
    backgroundColor: "#008751",
    borderRadius: 9,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  disabledButton: {
    opacity: 0.65,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  laterText: {
    color: "#E5F2EA",
    textAlign: "center",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  logoutButton: {
    alignSelf: "center",
    backgroundColor: "#008751",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 9,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});