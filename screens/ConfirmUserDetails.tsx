import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { useNavigation, useRoute } from "@react-navigation/native";

type NinResponse = {
  title: string;
  firstname: string;
  middlename: string;
  surname: string;
  birthdate: string;
  gender: string;
  nin: string;
  email: string;
  phone: string;
  password?: string;
};

type ApiResponse = {
  status: boolean;
  sessionId?: string;
  message?: string;
  sessionUser?: string;
  ninResponse?: NinResponse;
  livelinessPhoto?: string;
};

export default function ConfirmUserDetails() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const routeParams = route.params as { data?: ApiResponse } | undefined;
  const data = routeParams?.data;

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [expoToken, setExpoToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic API URL for Mobile Development
  const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    "http://10.0.2.2:8080/nativeverificationappbe";

  // If no data provided, alert and return to previous screen
  useEffect(() => {
    if (!data) {
      Alert.alert("Notice", "No data provided, returning back to previous page.");
      navigation.replace("HomeScreen");
    }
  }, [data, navigation]);

  // // 1. Retrieve the Expo Push Token on mount
  // useEffect(() => {
  //   const getExpoToken = async () => {
  //     try {
  //       const { status } = await Notifications.requestPermissionsAsync();
  //       if (status !== "granted") {
  //         console.warn("Notification permissions not granted.");
  //         return;
  //       }
  //       const tokenData = await Notifications.getExpoPushTokenAsync();
  //       setExpoToken(tokenData.data);
  //       console.log("Expo push token retrieved:", tokenData.data);
  //     } catch (error) {
  //       console.error("Error fetching Expo token on mount:", error);
  //     }
  //   };

  //   getExpoToken();
  // }, []);

  const processPhone = (phoneNum: string) => {
    const cleaned = phoneNum.replace(/\D/g, "");
    if (cleaned.length !== 11 || !cleaned.startsWith("0")) {
      Alert.alert("Invalid Phone", "Please enter a valid Nigerian phone number (11 digits starting with 0).");
      return null;
    }
    return cleaned;
  };

  const processEmail = (emailStr: string): string | null => {
    const cleaned = emailStr.replace(/\s+/g, "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleaned)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return null;
    }
    return cleaned;
  };

  const rejectAccount = () => {
    const sessionId = data?.sessionId;
    navigation.navigate("Home", { sessionId });
  };

  // 2. Send Expo token to backend along with userAccountId
  async function sendExpoTokenToBackend(token: string, userId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/saveexpotoken`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token, userAccountId: userId }),
      });
      const resData = await response.json();
      console.log("Expo token saved response:", resData);
      return resData;
    } catch (error) {
      console.error("Error sending Expo token to backend:", error);
    }
  }

  async function createAccount() {


    const activeEmail = email || data?.ninResponse?.email || "";
    const activePhone = phone || data?.ninResponse?.phone || "";

    const phoneData = processPhone(activePhone);
    if (!phoneData) return;

    const emailData = processEmail(activeEmail);
    if (!emailData) return;

    if (!password || password.length < 10) {
      Alert.alert("Password Error", "Please enter a valid password. Minimum 10 characters required.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/newuser/createaccount`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: data?.ninResponse?.title,
          firstname: data?.ninResponse?.firstname,
          middlename: data?.ninResponse?.middlename,
          surname: data?.ninResponse?.surname,
          birthdate: data?.ninResponse?.birthdate,
          gender: data?.ninResponse?.gender,
          nin: data?.ninResponse?.nin,
          email: emailData,
          phone: phoneData,
          password: password,
          livelinessPhoto: data?.livelinessPhoto || null,
        }),
      });

      const httpStatus = response.status;
      const dataReturned = await response.json();

      console.log("Create Account Response:", dataReturned);

      if (httpStatus === 200 || httpStatus === 201) {
        Alert.alert("Success", "Account created successfully!");

        if (dataReturned && dataReturned.sessionUser) {
          await SecureStore.setItemAsync("user_id", dataReturned.sessionUser);

          let tokenToSend = expoToken;
          if (!tokenToSend) {
            try {
              const newTokenData = await Notifications.getExpoPushTokenAsync();
              tokenToSend = newTokenData.data;
            } catch (err) {
              console.warn("Could not fetch Expo token prior to submission.");
            }
          }

          if (tokenToSend) {
            await sendExpoTokenToBackend(tokenToSend, dataReturned.sessionUser);
          }
        }

        navigation.navigate("OTPs", { dataReturned });
      } else {
        Alert.alert("Sign Up Failed", `(${httpStatus}): ${dataReturned.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Account creation network error:", error);
      Alert.alert("Network Error", "A network error occurred. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const handlePasswordChange = (text: string) => {
    const asciiOnly = text.replace(/[^\x00-\x7F]/g, "");
    setPassword(asciiOnly);
  };

  if (!data || !data.ninResponse) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.headerTitle}>Confirm Your Details & Create Account</Text>

          {/* NIN Verified Data Display Card */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>NIN Verification Data</Text>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Title:</Text>
              <Text style={styles.value}>{data.ninResponse.title ?? "Not Found"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>First Name:</Text>
              <Text style={styles.value}>{data.ninResponse.firstname ?? "Not Found"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Middle Name:</Text>
              <Text style={styles.value}>{data.ninResponse.middlename ?? "N/A"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Last Name:</Text>
              <Text style={styles.value}>{data.ninResponse.surname ?? "Not Found"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Date of Birth:</Text>
              <Text style={styles.value}>{data.ninResponse.birthdate ?? "Not Found"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Gender:</Text>
              <Text style={styles.value}>{data.ninResponse.gender ?? "Not Found"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>NIN:</Text>
              <Text style={styles.value}>{data.ninResponse.nin ?? "Not Found"}</Text>
            </View>
          </View>

          {/* User Input Modification Form */}
          <View style={styles.card}>
            <Text style={styles.instructionText}>
              If you no longer have access to your NIN email or phone, please provide alternatives below.
            </Text>

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder={data.ninResponse.email ?? "None associated with NIN"}
              placeholderTextColor="#A0A0A0"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder={data.ninResponse.phone ?? "None associated with NIN"}
              placeholderTextColor="#A0A0A0"
              value={phone}
              onChangeText={(text) => {
                const numbersOnly = text.replace(/[^0-9]/g, "");
                setPhone(numbersOnly.slice(0, 11));
              }}
              keyboardType="numeric"
              maxLength={11}
            />

            <Text style={styles.inputLabel}>Password (Min 10 characters)</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 10 characters"
              placeholderTextColor="#A0A0A0"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry
              autoCapitalize="none"
              maxLength={128}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={createAccount}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Reject Button */}
            <TouchableOpacity style={styles.secondaryButton} onPress={rejectAccount}>
              <Text style={styles.secondaryButtonText}>Reject Account</Text>
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
    backgroundColor: "#0A2E1D", // Nigerian Dark Green
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#008751",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  label: {
    fontWeight: "600",
    color: "#555",
    fontSize: 14,
  },
  value: {
    color: "#222",
    fontSize: 14,
  },
  instructionText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 14,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#008751",
    marginTop: 10,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#F9F9F9",
  },
  primaryButton: {
    backgroundColor: "#008751",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: "#7BA893",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "#D9534F",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});