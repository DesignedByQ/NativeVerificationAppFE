
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  CommonActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";

type ApiResponse = {
  sessionId: string;
  sessionUser: string;
  otpVerified: boolean;
};

type ProfileRouteParams = {
  dataReturned?: ApiResponse;
};

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "http://10.0.2.2:8080/nativeverificationappbe";

export default function UserProfilePage() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const { dataReturned } = (route.params ?? {}) as ProfileRouteParams;

  const [userID, setUserID] = useState("");
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [grade, setGrade] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleUserSessionAndVerification = async () => {
      try {
        console.log("dataReturned:", dataReturned);

        const storedUserId =
          (await SecureStore.getItemAsync("user_id")) ?? "";

        if (dataReturned?.sessionUser) {
          if (!cancelled) {
            setUserID(dataReturned.sessionUser);
          }

          if (storedUserId !== dataReturned.sessionUser) {
            await SecureStore.setItemAsync(
              "user_id",
              dataReturned.sessionUser
            );
          }
        } else if (!cancelled) {
          setUserID(storedUserId);
        }

        if (!dataReturned?.sessionUser && !dataReturned?.sessionId) {
          console.error(
            "Cannot verify OTPs: sessionUser and sessionId are missing"
          );
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/controller/verify-otps`,
          {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("OTP verification result:", result);

        if (
          !cancelled &&
          (result.emailVerification === false ||
            result.phoneVerification === false)
        ) {
          navigation.navigate("OTPs", { dataReturned } as never);
        }
      } catch (error) {
        console.error("Error verifying OTPs:", error);
      }
    };

    handleUserSessionAndVerification();

    const getConfidenceScore = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/controller/getconfidencescore`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setConfidenceScore(result);
        console.log("Confidence score result:", result);

        if (result >= 90) {
          setGrade("A");
        } else if (result >= 72) {
          setGrade("B");
        } else if (result >= 63) {
          setGrade("C");
        } else if (result >= 55) {
          setGrade("D");
        } else {
          setGrade("E");
        }

      } catch (error) {
        console.error("Error fetching confidence score:", error);
      }
    };

    getConfidenceScore();

    return () => {
      cancelled = true;
    };
  }, [dataReturned, navigation]);

  const openScreen = (screenName: string) => {
    navigation.navigate(screenName as never, { dataReturned } as never);
  };

  const clearUserSession = async () => {
    try {
      await SecureStore.deleteItemAsync("user_id");

      console.log("Device session data cleared");

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Home" }],
        })
      );
    } catch (error) {
      console.error("Failed to clear secure storage:", error);
      Alert.alert("Logout failed", "Unable to clear your saved session.");
    }
  };

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>CVT</Text>
            </View>
            <Text style={styles.headerTitle}>Check Verify Trust</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>User Profile Overview</Text>
            <Text style={styles.cardInstruction}>
              Connected profile details and account status tracking.
            </Text>

            <Text style={styles.label}>User ID</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                #{userID || dataReturned?.sessionUser || "N/A"}
              </Text>
            </View>

            <Text style={styles.label}>Confidence Score</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{confidenceScore !== null ? confidenceScore : "N/A"}</Text>
            </View>

            <Text style={styles.label}>Grade</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{grade !== null ? grade : "N/A"}</Text>
            </View>
          </View>

          <View style={styles.actionSection}>
            <ActionButton
              label="My Profile"
              onPress={() => openScreen("MyProfile")}
            />
            <ActionButton
              label="Address"
              onPress={() => openScreen("Address")}
            />
            <ActionButton
              label="IDs"
              onPress={() => openScreen("DocumentUpload")}
            />
            <ActionButton label="BVN" onPress={() => openScreen("BVN")} />
            <ActionButton
              label="Signature"
              onPress={() => openScreen("Signature")}
            />
            <ActionButton
              label="Bookings"
              onPress={() => openScreen("Bookings")}
            />
            <ActionButton label="Visa" onPress={() => openScreen("Visa")} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Transaction History</Text>
            <Text style={styles.cardInstruction}>
              Recent verification audit trail.
            </Text>

            {[1, 2, 3].map((item) => (
              <View key={item} style={styles.historyBox}>
                <Text style={styles.historyText}>-</Text>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <ActionButton
              label="Logout"
              onPress={clearUserSession}
              logout
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  logout = false,
}: {
  label: string;
  onPress: () => void;
  logout?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, logout && styles.logoutButton]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#0A2E1D",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 20,
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
  headerTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 24,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1C1C1C",
  },
  cardInstruction: {
    fontSize: 13,
    color: "#666",
    marginVertical: 6,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#008751",
    marginTop: 12,
    marginBottom: 4,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F9F9F9",
  },
  infoText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  actionSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#008751",
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  logoutButton: {
    backgroundColor: "#B22222",
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  historyBox: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F9F9F9",
    marginTop: 8,
  },
  historyText: {
    fontSize: 14,
    color: "#666",
  },
  footer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
});
