import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { useRoute } from "@react-navigation/native";

type ApiResponse = {
  loginStatus: boolean;
  sessionId?: string;
  userId?: string;
  sessionUser?: string;
  message: string;
};

export default function LoginScreen({ navigation }: any) {
  const route = useRoute();
  const routeParams = route.params as { data?: ApiResponse } | undefined;
  const dataReturned = routeParams?.data;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic API URL for Expo Mobile Development
  const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    "http://10.0.2.2:8080/nativeverificationappbe";

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter both your email and password.");
      return;
    }

    setIsLoading(true);
    console.log("Attempting to log in with:", email);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      if (!response.ok) {
        console.error("Login request failed with status:", response.status);
        Alert.alert(
          "Login Failed",
          "Login request failed. Please check your credentials and try again."
        );
        return;
      }

      const data = await response.json();
      console.log("Login response data:", data);

      console.log("Login response headers:", response.headers);
      console.log(
        "Set-Cookie header:",
        response.headers.get("set-cookie")
      );

      const apiResponse: ApiResponse = {
        sessionId: data.sessionId ?? "",
        userId: data.userId ?? "",
        sessionUser: data.userId ?? "",
        loginStatus: data.loginStatus ?? false,
        message: data.message ?? "Login failed.",
      };


      // Persist the user ID only; session continuity uses JSESSIONID.
      if (apiResponse.userId) {
        await SecureStore.setItemAsync("user_id", apiResponse.userId);
      }

      if (apiResponse.loginStatus) {
        
        navigation.navigate("UserProfilePage", { dataReturned: apiResponse });
      } else {
        console.error("Login failed. Message:", data.message);
        Alert.alert("Login Failed", data.message || "Invalid email or password.");
      }
    } catch (error) {
      console.error("An error occurred during login:", error);
      Alert.alert(
        "Connection Error",
        "Unable to connect to server. Please check your network connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const backToSignUp = () => {
    navigation.navigate("Home");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header & Logo */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>CVT</Text>
            </View>
            <Text style={styles.headerTitle}>Check Verify Trust</Text>
            <Text style={styles.headerSubtitle}>Sign in to your account</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. user@domain.ng"
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#A0A0A0"
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={backToSignUp}>
              <Text style={styles.secondaryButtonText}>Create an Account / Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A2E1D", // Nigerian Identity Dark Green
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
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
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 20,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#A2C5B3",
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#008751",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#F9F9F9",
  },
  primaryButton: {
    backgroundColor: "#008751",
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  disabledButton: {
    backgroundColor: "#7BA893",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  footer: {
    alignItems: "center",
    marginTop: 30,
  },
  footerText: {
    color: "#A2C5B3",
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});