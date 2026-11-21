import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";

type APIresponse = {
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
  liveliness?: string;
};

type EditableField = "email" | "phone" | "password";

const editableFields: EditableField[] = ["email", "phone", "password"];

export default function MyProfile() {
  const navigation = useNavigation<any>();
  const route = useRoute();

  const baseUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    "http://10.0.2.2:8080/nativeverificationappbe";

  const [userDetails, setUserDetails] = useState<APIresponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    let isMounted = true;

    const getUserDetails = async () => {
      try {
        const sessionId = await SecureStore.getItemAsync("user_http_session");

        const response = await fetch(`${baseUrl}/api/controller/userdata`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(sessionId ? { Authorization: sessionId } : {}),
          },
        });

        if (!response.ok) {
          throw new Error(`Unable to load profile (HTTP ${response.status})`);
        }

        const apiData = await response.json();
        console.log("User data:", apiData);

        // Supports either a direct user object or a { user: ... } response.
        const source = apiData.user ?? apiData;

        const mappedUser: APIresponse = {
          title: source.title ?? "",
          firstname: source.firstName ?? "",
          middlename: source.middleName ?? "",
          surname: source.lastName ?? "",
          birthdate: source.birthdate ?? "",
          gender: source.gender ?? "",
          nin: source.nin ?? "",
          email: source.email ?? "",
          phone: source.phone ?? "",
          password: source.password,
          liveliness: source.livelinessPhoto,
        };

        if (isMounted) {
          setUserDetails(mappedUser);
        }
      } catch (error) {
        console.error("Error retrieving user data:", error);
        if (isMounted) {
          Alert.alert(
            "Unable to load profile",
            error instanceof Error ? error.message : "Please try again."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getUserDetails();

    return () => {
      isMounted = false;
    };
  }, [baseUrl]);

  const getFieldValue = (field: EditableField) => {
    if (field === "password") {
      return "Not displayed";
    }

    return userDetails?.[field] || "N/A";
  };

  const startEditing = (field: EditableField) => {
    setEditingField(field);
    setNewValue("");
  };

  const cancelEditing = () => {
    setEditingField(null);
    setNewValue("");
  };

  const saveField = async (field: EditableField) => {
    const value = newValue.trim();

    if (!value) {
      Alert.alert("Missing value", `Enter your new ${field}.`);
      return;
    }

    const endpointByField: Record<EditableField, string> = {
      email: "/api/controller/update-email",
      phone: "/api/controller/update-phone",
      password: "/api/controller/update-password",
    };

    const payloadKeyByField: Record<EditableField, string> = {
      email: "email",
      phone: "phone",
      password: "password",
    };

    try {
      setSaving(true);
      const sessionId = await SecureStore.getItemAsync("user_http_session");

      const response = await fetch(`${baseUrl}${endpointByField[field]}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(sessionId ? { Authorization: sessionId } : {}),
        },
        body: JSON.stringify({ [payloadKeyByField[field]]: value }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Update failed (HTTP ${response.status})`);
      }

      // Reload the profile so the displayed value matches the backend response.
      const refreshedResponse = await fetch(
        `${baseUrl}/api/controller/userdata`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(sessionId ? { Authorization: sessionId } : {}),
          },
        }
      );

      if (!refreshedResponse.ok) {
        throw new Error("Saved, but could not refresh the profile.");
      }

      const refreshedData = await refreshedResponse.json();
      const source = refreshedData.user ?? refreshedData;

      setUserDetails({
        title: source.title ?? "",
        firstname: source.firstname ?? "",
        middlename: source.middlename ?? "",
        surname: source.surname ?? "",
        birthdate: source.birthdate ?? "",
        gender: source.gender ?? "",
        nin: source.nin ?? "",
        email: source.email ?? "",
        phone: source.phone ?? "",
        password: source.password,
        liveliness: source.liveliness,
      });

      setEditingField(null);
      setNewValue("");
      Alert.alert("Updated", `${field} updated successfully.`);
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      Alert.alert(
        `Unable to update ${field}`,
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const getLivelinessImageUri = (value?: string) => {
    if (!value) return null;

    // Use an existing data URI as-is; otherwise assume the API returned JPEG Base64.
    return value.startsWith("data:image/")
      ? value
      : `data:image/jpeg;base64,${value}`;
  };

  const renderField = (label: string, field: keyof APIresponse) => {
    
    if (field === "liveliness") {
      const imageUri = getLivelinessImageUri(userDetails?.liveliness);

      return (
        <View style={styles.fieldContainer} key={field}>
          <Text style={styles.label}>{label}</Text>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.livelinessImage} />
          ) : (
            <Text>No liveliness photo available.</Text>
          )}
        </View>
      );
    }

    // Keep the rest of your existing renderField code below this point.
    const isEditable = editableFields.includes(field as EditableField);
    const editableField = field as EditableField;

    if (isEditable && editingField === editableField) {
      return (
        <View style={styles.fieldContainer} key={field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={newValue}
            onChangeText={setNewValue}
            placeholder={
              field === "password"
                ? "Enter a new password"
                : `Current: ${String(userDetails?.[field] || "N/A")}`
            }
            secureTextEntry={field === "password"}
            keyboardType={
              field === "email"
                ? "email-address"
                : field === "phone"
                  ? "phone-pad"
                  : "default"
            }
            autoCapitalize={field === "email" ? "none" : "sentences"}
            editable={!saving}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={() => saveField(editableField)}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? "Saving..." : `Save new ${field}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={cancelEditing}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const value =
      field === "password"
        ? "Not displayed"
        : String(userDetails?.[field] || "N/A");

    return (
      <View style={styles.fieldContainer} key={field}>
        <Text style={styles.label}>
          {label}: {value}
        </Text>
        {isEditable && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => startEditing(editableField)}
          >
            <Text style={styles.buttonText}>{`Edit ${field}`}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.label}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!userDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.label}>Profile data is unavailable.</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleBack}
        >
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.cardTitle}>My Profile Details</Text>
            <Text style={styles.cardInstruction}>Account details.</Text>
          </View>

          {renderField("Title", "title")}
          {renderField("First Name", "firstname")}
          {renderField("Middle Name", "middlename")}
          {renderField("Surname", "surname")}
          {renderField("Birthdate", "birthdate")}
          {renderField("Gender", "gender")}
          {renderField("NIN", "nin")}
          {renderField("Email", "email")}
          {renderField("Phone", "phone")}
          {renderField("Password", "password")}
          {renderField("Liveliness", "liveliness")}

          <View style={styles.fieldContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleBack}
            >
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#0A2E1D",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoBadgeText: {
    fontWeight: "bold",
    fontSize: 20,
    color: "#0A2E1D",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  livelinessImage: {
    width: 220,
    height: 220,
    alignSelf: "center",
    resizeMode: "contain",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: "#0A2E1D",
    fontSize: 20,
    fontWeight: "bold",
  },
  cardInstruction: {
    color: "#008751",
    marginTop: 6,
  },
  fieldContainer: {
    backgroundColor: "#008751",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderColor: "#0A2E1D",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0A2E1D",
    marginBottom: 10,
  },
  buttonRow: {
    gap: 8,
  },
  button: {
    backgroundColor: "#0A2E1D",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});