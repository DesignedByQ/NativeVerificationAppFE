import React, { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Modal, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { useNavigation, useRoute } from "@react-navigation/native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ||
  "http://10.0.2.2:8080/nativeverificationappbe";

interface DocMetadata {
  id: string; label: string; placeholder: string; regex: RegExp;
  errorMessage: string; hasExpiryDate: boolean; maxLength: number;
}
const DOCUMENT_TYPES: DocMetadata[] = [
  { id: "NATIONAL_ID", label: "National ID (NIN)", placeholder: "11-digit NIN",
    regex: /^\d{11}$/, errorMessage: "National ID (NIN) must be exactly 11 digits.",
    hasExpiryDate: false, maxLength: 11 },
  { id: "VOTERS_CARD", label: "Voter's Card (VIN)", placeholder: "19-character VIN",
    regex: /^[A-Za-z0-9]{19}$/, errorMessage: "Voter's Card ID (VIN) must be 19 alphanumeric characters.",
    hasExpiryDate: false, maxLength: 19 },
  { id: "DRIVERS_LICENSE", label: "Driver's License", placeholder: "12-character license number",
    regex: /^[A-Za-z0-9]{12}$/, errorMessage: "Driver's License number must be 12 alphanumeric characters.",
    hasExpiryDate: true, maxLength: 12 },
  { id: "PASSPORT", label: "Passport Number", placeholder: "9-character passport number",
    regex: /^[A-Za-z0-9]{9}$/, errorMessage: "Passport number must be 9 alphanumeric characters.",
    hasExpiryDate: true, maxLength: 9 },
];

type UploadSource = "file" | "camera" | null;
type SelectedDocument = { base64: string; fileName: string; mimeType: string };

export default function DocumentUpload() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dataReturned = route.params?.dataReturned ?? route.params?.data ?? {};
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [docType, setDocType] = useState("");
  const [document, setDocument] = useState<SelectedDocument | null>(null);
  const [uploadSource, setUploadSource] = useState<UploadSource>(null);
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [docNumbers, setDocNumbers] = useState<Record<string, string>>({});
  const [cameraVisible, setCameraVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedDocMeta = DOCUMENT_TYPES.find((item) => item.id === docType);

  const resetFormFields = () => {
    setDocType(""); setDocument(null); setUploadSource(null);
    setExpiryDates({}); setDocNumbers({});
  };
  const selectDocumentType = (id: string) => {
    if (!docType || docType === id) setDocType(id);
  };
  const handleDocNumberChange = (id: string, value: string) => {
    selectDocumentType(id);
    setDocNumbers((previous) => ({ ...previous, [id]: value }));
  };
  const handleDateChange = (id: string, value: string) => {
    selectDocumentType(id);
    setExpiryDates((previous) => ({ ...previous, [id]: value }));
  };

  const getBase64Document = async (uri: string, mimeType: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${mimeType};base64,${base64}`;
  };

  const handleFileUpload = async (id: string) => {
    if (docType && docType !== id) return;
    setDocType(id);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"], copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ||
        (asset.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
        Alert.alert("Unsupported file", "Please select an image or PDF file."); return;
      }
      const base64 = await getBase64Document(asset.uri, mimeType);
      setDocument({ base64, fileName: asset.name, mimeType });
      setUploadSource("file");
    } catch (error) {
      console.error("Document file selection error:", error);
      Alert.alert("File error", "Unable to read the selected file. Please try again.");
    }
  };

  const handleCameraClick = async (id: string) => {
    if (docType && docType !== id) return;
    setDocType(id);
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert("Camera permission required",
          "Please allow camera access in device settings, or use Upload Document.");
        return;
      }
    }
    setCameraVisible(true);
  };
  const closeCamera = () => setCameraVisible(false);

  const capturePhoto = async () => {
    if (!cameraRef.current || !docType) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) {
        Alert.alert("Camera error", "The photo could not be captured."); return;
      }
      const base64 = await getBase64Document(photo.uri, "image/jpeg");
      setDocument({
        base64, fileName: `captured_${docType.toLowerCase()}_${Date.now()}.jpg`,
        mimeType: "image/jpeg",
      });
      setUploadSource("camera");
      closeCamera();
    } catch (error) {
      console.error("Document photo capture error:", error);
      Alert.alert("Camera error", "Unable to capture the document photo.");
    }
  };

  const handleUpload = async () => {
    if (!docType) {
      Alert.alert("Document required", "Please select a document type."); return;
    }
    const meta = DOCUMENT_TYPES.find((item) => item.id === docType);
    const number = docNumbers[docType]?.trim();
    if (!number) {
      Alert.alert("Document number required",
        `Please enter a valid ${meta?.label || "document"} ID number.`); return;
    }
    if (meta && !meta.regex.test(number)) {
      Alert.alert("Invalid document number", meta.errorMessage); return;
    }
    if (meta?.hasExpiryDate && !expiryDates[docType]) {
      Alert.alert("Expiry date required",
        "Please enter an expiry date for the selected document type."); return;
    }
    if (!document?.base64) {
      Alert.alert("Document required",
        "Please upload an image/PDF or take a photograph before submitting."); return;
    }

    const payload = {
      ...dataReturned,
      documentType: docType,
      documentNumber: number,
      documentImage: document.base64,
      expiryDate: meta?.hasExpiryDate ? expiryDates[docType] : null,
      uploadSource,
      issuingCountry: "NGA",
    };
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/controller/documents`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      
      let responseData: any = null;
      try { responseData = responseText ? JSON.parse(responseText) : null; }
      catch { throw new Error(`Unexpected server response (HTTP ${response.status}).`); }
      if (!response.ok) {
        throw new Error(responseData?.message ||
          `Document upload failed with HTTP ${response.status}.`);
      }
      if (responseData?.documentUploaded === true) {
        Alert.alert("Upload successful",
          responseData.message || "Document upload successful!");
        resetFormFields();
      } else {
        Alert.alert("Upload not completed",
          responseData?.message || "The server did not confirm the document upload.");
      }
    } catch (error) {
      console.error("Error during document upload:", error);
      Alert.alert("Document upload error", error instanceof Error
        ? error.message : "An error occurred during document upload. Please try again.");
    } finally { setSaving(false); }
  };

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync("user_id");
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Logout error", "Unable to clear the local session.");
    }
  };

  const renderDocumentRow = (doc: DocMetadata) => {
    const selected = docType === doc.id;
    const disabled = docType !== "" && !selected;
    return (
      <View key={doc.id} style={[
        styles.documentRow, selected && styles.documentRowSelected,
        disabled && styles.documentRowDisabled,
      ]}>
        <Text style={styles.documentTitle}>{doc.label}</Text>
        <View style={styles.rowActions}>
          <TouchableOpacity disabled={disabled}
            style={[styles.smallButton, selected && uploadSource === "file"
              ? styles.successButton : styles.blueButton, disabled && styles.disabledButton]}
            onPress={() => handleFileUpload(doc.id)}>
            <Text style={styles.smallButtonText}>Upload</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={disabled}
            style={[styles.smallButton, selected && uploadSource === "camera"
              ? styles.successButton : styles.tealButton, disabled && styles.disabledButton]}
            onPress={() => handleCameraClick(doc.id)}>
            <Text style={styles.smallButtonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={[styles.input, disabled && styles.disabledInput]}
          editable={!disabled} placeholder={doc.placeholder} placeholderTextColor="#888"
          value={docNumbers[doc.id] || ""} onFocus={() => selectDocumentType(doc.id)}
          onChangeText={(value) => handleDocNumberChange(doc.id, value)}
          maxLength={doc.maxLength} autoCapitalize="characters" autoCorrect={false} />
        {doc.hasExpiryDate ? <>
          <Text style={styles.fieldLabel}>Expiry Date (YYYY-MM-DD)</Text>
          <TextInput style={[styles.input, disabled && styles.disabledInput]}
            editable={!disabled} placeholder="YYYY-MM-DD" placeholderTextColor="#888"
            value={expiryDates[doc.id] || ""} onFocus={() => selectDocumentType(doc.id)}
            onChangeText={(value) => handleDateChange(doc.id, value)}
            keyboardType="numbers-and-punctuation" maxLength={10} />
        </> : null}
      </View>
    );
  };

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoBadge}><Text style={styles.logoBadgeText}>CVT</Text></View>
            <Text style={styles.headerTitle}>Check Verify Trust</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nigerian Document Verification</Text>
            <Text style={styles.cardInstruction}>
              Provide your Nigerian document ID number, expiry date where applicable,
              and upload or capture an image of your document.
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Select one document type. Other document types remain locked until
                you submit successfully or reset the form.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Select Document Type</Text>
            {DOCUMENT_TYPES.map(renderDocumentRow)}
          </View>

          {docType ? <View style={styles.card}>
            <Text style={styles.cardTitle}>Selected Document</Text>
            <Text style={styles.cardInstruction}>
              {selectedDocMeta?.label} · {uploadSource === "camera"
                ? "Camera capture" : uploadSource === "file" ? "File upload" : "Image pending"}
            </Text>
            {docNumbers[docType] ? <Text style={styles.statusText}>
              Document number: {docNumbers[docType]}
            </Text> : null}
            {selectedDocMeta?.hasExpiryDate && expiryDates[docType] ? <Text style={styles.statusText}>
              Expiry date: {expiryDates[docType]}
            </Text> : null}
            {document ? <View style={styles.previewContainer}>
              <Text style={styles.fieldLabel}>Selected file</Text>
              <Text style={styles.fileName}>{document.fileName}</Text>
              {document.mimeType.startsWith("image/") ? <Image
                source={{ uri: document.base64 }} style={styles.documentPreview}
                resizeMode="contain" /> : <View style={styles.pdfPreview}>
                <Text style={styles.pdfIcon}>PDF</Text>
                <Text style={styles.pdfText}>PDF document ready to upload</Text>
              </View>}
            </View> : <Text style={styles.mutedText}>No document file selected yet.</Text>}
          </View> : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Submit Verification</Text>
            <Text style={styles.cardInstruction}>
              Check your document details before submitting them for verification.
            </Text>
            <TouchableOpacity style={[styles.primaryButton,
              (!docType || !document || saving) && styles.disabledButton]}
              disabled={!docType || !document || saving} onPress={handleUpload}>
              {saving ? <ActivityIndicator color="#FFF" /> :
                <Text style={styles.buttonText}>Submit Verification</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetButton} disabled={saving}
              onPress={() => Alert.alert("Reset form",
                "Clear the selected document and all entered details?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Reset", style: "destructive", onPress: resetFormFields },
                ])}>
              <Text style={styles.buttonText}>Reset Form</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={cameraVisible} animationType="slide" onRequestClose={closeCamera}>
        <SafeAreaView style={styles.cameraModal}>
          <Text style={styles.cameraTitle}>Capture Document Photo</Text>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.cameraActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={closeCamera}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={capturePhoto}>
              <Text style={styles.buttonText}>Capture Photo</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#0A2E1D" },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 36 },
  header: { alignItems: "center", paddingTop: 20, paddingBottom: 20 },
  logoBadge: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#008751",
    alignItems: "center", justifyContent: "center", marginBottom: 10 },
  logoBadgeText: { color: "#FFF", fontWeight: "bold", fontSize: 20 },
  headerTitle: { color: "#FFF", fontSize: 24, fontWeight: "bold" },
  card: { backgroundColor: "#FFF", borderRadius: 16, marginHorizontal: 20,
    marginBottom: 18, padding: 20, elevation: 5 },
  cardTitle: { fontSize: 20, fontWeight: "bold", color: "#1C1C1C" },
  cardInstruction: { fontSize: 13, color: "#666", marginTop: 6, marginBottom: 10, lineHeight: 19 },
  documentRow: { borderWidth: 1, borderColor: "#DDD", borderRadius: 10,
    padding: 12, marginTop: 12, backgroundColor: "#F9FAFB" },
  documentRowSelected: { borderWidth: 2, borderColor: "#007BFF", backgroundColor: "#EFF6FF" },
  documentRowDisabled: { opacity: 0.4 },
  documentTitle: { color: "#222", fontSize: 15, fontWeight: "bold", marginBottom: 10 },
  rowActions: { flexDirection: "row", gap: 8, marginBottom: 10 },
  smallButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 6, alignItems: "center", justifyContent: "center" },
  smallButtonText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },
  blueButton: { backgroundColor: "#007BFF" },
  tealButton: { backgroundColor: "#17A2B8" },
  successButton: { backgroundColor: "#28A745" },
  input: { borderWidth: 1, borderColor: "#DDD", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: "#FFF",
    color: "#333", fontSize: 14, marginTop: 4 },
  disabledInput: { backgroundColor: "#EEE", color: "#777" },
  fieldLabel: { color: "#008751", fontSize: 12, fontWeight: "700", marginTop: 12, marginBottom: 4 },
  infoBox: { borderWidth: 1, borderColor: "#D7E6DD", borderRadius: 8,
    padding: 12, marginTop: 8, backgroundColor: "#F3FAF6" },
  infoText: { color: "#315B43", fontSize: 13, lineHeight: 18 },
  statusText: { color: "#333", fontSize: 13, marginTop: 6 },
  previewContainer: { marginTop: 8 },
  fileName: { color: "#333", fontSize: 13, marginTop: 4 },
  documentPreview: { width: "100%", height: 190, borderWidth: 1, borderColor: "#DDD",
    borderRadius: 8, marginTop: 10, backgroundColor: "#FAFAFA" },
  pdfPreview: { minHeight: 100, borderWidth: 1, borderColor: "#DDD", borderRadius: 8,
    marginTop: 10, backgroundColor: "#F9FAFB", alignItems: "center",
    justifyContent: "center", padding: 14 },
  pdfIcon: { color: "#B22222", fontSize: 24, fontWeight: "bold" },
  pdfText: { color: "#444", fontSize: 13, marginTop: 6 },
  mutedText: { color: "#777", fontSize: 13, marginTop: 8 },
  primaryButton: { backgroundColor: "#008751", borderRadius: 8, paddingVertical: 15,
    paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginTop: 12 },
  resetButton: { backgroundColor: "#6C757D", borderRadius: 8, paddingVertical: 14,
    alignItems: "center", marginTop: 10 },
  buttonText: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
  disabledButton: { opacity: 0.5 },
  footer: { marginHorizontal: 20, marginBottom: 20, gap: 10 },
  backButton: { backgroundColor: "#EF4444", borderRadius: 8, paddingVertical: 15, alignItems: "center" },
  logoutButton: { backgroundColor: "#374151", borderRadius: 8, paddingVertical: 15, alignItems: "center" },
  cameraModal: { flex: 1, backgroundColor: "#0A2E1D", padding: 16 },
  cameraTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold", textAlign: "center", paddingVertical: 16 },
  camera: { flex: 1, borderRadius: 12, overflow: "hidden" },
  cameraActions: { flexDirection: "row", gap: 12, paddingVertical: 18 },
  cancelButton: { flex: 1, backgroundColor: "#B22222", borderRadius: 8, padding: 14, alignItems: "center" },
  captureButton: { flex: 1, backgroundColor: "#008751", borderRadius: 8, padding: 14, alignItems: "center" },
});
