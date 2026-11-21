import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar, StatusBarStyle } from "expo-status-bar";

// Types
type ApiResponse = {
  status: boolean;
  sessionId?: string;
  message: string;
  ninResponse?: {
    birthdate: string;
    email: string | null;
    firstname: string;
    middlename: string;
    surname: string;
    phone: string;
    nin: string;
    gender: string;
    title: string;
    password: string | null;
  };
  livelinessPhoto?: string;
};

export default function HomeScreen({ navigation }: any) {

    const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8080/nativeverificationappbe";

    const statusBarStyle: StatusBarStyle = "light";

    const [nin, setNin] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [failedSessionId, setFailedSessionId] = useState("");
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = React.useRef<any>(null);

    const handleLogin = () => {
        navigation.navigate("LoginScreen");
    };

    const handleTakeSelfie = async () => {
        if (!nin || nin.length !== 11) {
        Alert.alert("Invalid NIN", "Please enter a valid 11-character NIN before taking a selfie.");
        return;
    }

    if (!permission?.granted) {
        const permissionResponse = await requestPermission();
        if (!permissionResponse.granted) {
            Alert.alert("Permission Required", "Camera access is needed to take a verification selfie.");
            return;
        }
    }

        setShowCamera(true);
    };

    const captureAndVerify = async (base64Image: string) => {
        setIsVerifying(true);
        setShowCamera(false);

        try {

        const response = await fetch(`${baseUrl}/api/newuser/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                nin: nin,
                image: base64Image,
                birthdate: "2000-01-01",
            }),
        });

        if (!response.ok) {
            Alert.alert("Error", `Signup failed with status code: ${response.status}`);
            return;
        }

        const raw = await response.json();
        const apiResponse: ApiResponse = {
            status: raw.status ?? false,
            sessionId: raw.sessionId ?? undefined,
            message: raw.message ?? "",
            ninResponse: raw.ninResponse ?? undefined,
            livelinessPhoto: base64Image
        };


        if (response.status === 200 && apiResponse.status) {
            Alert.alert("Success", apiResponse.message || "Identity verified!");
            navigation.navigate("ConfirmUserDetails", { data: apiResponse });
        } else {
            setFailedSessionId(raw.sessionId || "");
            Alert.alert("Verification Failed", apiResponse.message || "Failed to verify identity.");
        }
        } catch (error) {
        console.error("Verification error:", error);
        Alert.alert("Connection Error", "Unable to connect to verification server.");
        } finally {
        setIsVerifying(false);
        }
    };

    const takePicture = async () => {
        if (cameraRef.current) {
        const options = { quality: 0.7, base64: true };
        const data = await cameraRef.current.takePictureAsync(options);
        if (data?.base64) {
            captureAndVerify(`data:image/jpeg;base64,${data.base64}`);
        }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
        <StatusBar style={statusBarStyle} />

        {/* Header Banner */}
        <View style={styles.header}>
            <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>CVT</Text>
            </View>
            <Text style={styles.headerTitle}>Check Verify Trust</Text>
            <Text style={styles.headerSubtitle}>Nigerian Identity & Address Verification Platform</Text>
        </View>

        {/* Main Action Card */}
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Identity Verification</Text>
            <Text style={styles.cardInstruction}>
            Enter your 11-digit National Identification Number (NIN) to begin face matching.
            </Text>

            <Text style={styles.label}>NIN Identification</Text>
            <TextInput
            style={styles.input}
            value={nin}
            onChangeText={(text) => setNin(text.toUpperCase())}
            placeholder="e.g. 12345678901"
            placeholderTextColor="#A0A0A0"
            maxLength={11}
            keyboardType="numeric"
            />

            <TouchableOpacity
            style={[styles.primaryButton, isVerifying && styles.disabledButton]}
            onPress={handleTakeSelfie}
            disabled={isVerifying}
            >
            {isVerifying ? (
                <ActivityIndicator color="#FFF" />
            ) : (
                <Text style={styles.primaryButtonText}>Verify & Take Selfie</Text>
            )}
            </TouchableOpacity>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleLogin}>
            <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
        </View>

        {/* Native Camera Modal */}
        <Modal visible={showCamera} animationType="slide">
            <View style={styles.cameraContainer}>
            <CameraView style={styles.camera} facing="front" ref={cameraRef}>
                <View style={styles.cameraOverlay}>
                <View style={styles.faceFrame} />
                <Text style={styles.cameraGuideText}>Position your face inside the oval frame</Text>

                <View style={styles.cameraControls}>
                    <TouchableOpacity style={styles.cancelCameraButton} onPress={() => setShowCamera(false)}>
                    <Text style={styles.cancelCameraText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                    <View style={styles.captureButtonInner} />
                    </TouchableOpacity>
                </View>
                </View>
            </CameraView>
            </View>
        </Modal>
        </SafeAreaView>
    );
    }

    const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0A2E1D", // Nigerian Identity Dark Green theme
    },
    header: {
        alignItems: "center",
        paddingTop: 30,
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
    headerSubtitle: {
        color: "#A2C5B3",
        fontSize: 13,
        marginTop: 4,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        marginHorizontal: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
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
        marginVertical: 10,
        lineHeight: 18,
    },
    label: {
        fontSize: 12,
        fontWeight: "700",
        color: "#008751",
        marginTop: 15,
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
        marginTop: 20,
    },
    disabledButton: {
        backgroundColor: "#7BA893",
    },
    primaryButtonText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    footer: {
        alignItems: "center",
        marginTop: "auto",
        paddingBottom: 30,
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
        color: "#FFF",
        fontSize: 16,
        fontWeight: "bold",
        textDecorationLine: "underline",
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: "#000",
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 40,
    },
    faceFrame: {
        width: 260,
        height: 340,
        borderRadius: 170,
        borderWidth: 3,
        borderColor: "#008751",
        marginTop: 60,
    },
    cameraGuideText: {
        color: "#FFF",
        fontSize: 14,
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    cameraControls: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        width: "100%",
        paddingHorizontal: 30,
    },
    cancelCameraButton: {
        padding: 12,
    },
    cancelCameraText: {
        color: "#FFF",
        fontSize: 16,
    },
    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "#FFF",
        justifyContent: "center",
        alignItems: "center",
    },
    captureButtonInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderWidth: 2,
        borderColor: "#008751",
        backgroundColor: "#FFF",
    },
});