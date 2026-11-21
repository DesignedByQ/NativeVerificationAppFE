
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import SignatureScreen from "react-native-signature-canvas";

type Coordinates = {
  lat: number;
  lng: number;
};

type AddressDetails = {
  number: string;
  buildingName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  description: string;
};

type RouteParams = {
  dataReturned?: {
    sessionId?: string;
    sessionUser?: string;
  };
};

type PhotoType = "gate" | "door" | "face";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "http://10.0.2.2:8080/nativeverificationappbe";

const GEOAPIFY_API_KEY =
  process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || "";

const EMPTY_ADDRESS: AddressDetails = {
  number: "",
  buildingName: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  description: "",
};

export default function Address() {
  const navigation =
    useNavigation<NativeStackNavigationProp<any>>();

  const route = useRoute();
  const { dataReturned } = (route.params ?? {}) as RouteParams;

  const cameraRef = useRef<CameraView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeRef = useRef<number | null>(null);

  const [userId, setUserId] = useState("");

  const [userAddress, setUserAddress] =
    useState<AddressDetails>(EMPTY_ADDRESS);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [addressCoords, setAddressCoords] =
    useState<Coordinates | null>(null);

  const [deviceCoords, setDeviceCoords] =
    useState<Coordinates | null>(null);

  const [disableAddressInput, setDisableAddressInput] = useState(false);
  const [addressVerified] = useState(false);

  const [loadingAddress, setLoadingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [range, setRange] = useState<number | null>(null);

  const [gatePhoto, setGatePhoto] = useState("");
  const [doorPhoto, setDoorPhoto] = useState("");
  const [facePhoto, setFacePhoto] = useState("");

  const [isVerifyingGatePhoto, setIsVerifyingGatePhoto] = useState(false);
  const [isVerifyingDoorPhoto, setIsVerifyingDoorPhoto] = useState(false);
  const [isVerifyingFacePhoto, setIsVerifyingFacePhoto] = useState(false);

  const [activeCamera, setActiveCamera] = useState<PhotoType | null>(null);
  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const [signature, setSignature] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  const signatureRef = useRef<any>(null);

  const updateAddressField = (
    field: keyof AddressDetails,
    value: string
  ) => {
    setUserAddress((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // Load the user ID from SecureStore.
  useEffect(() => {
    let cancelled = false;

    const loadUserId = async () => {
      try {
        const storedUserId =
          (await SecureStore.getItemAsync("user_id")) ||
          dataReturned?.sessionUser ||
          "";

        if (storedUserId && !cancelled) {
          setUserId(storedUserId);

          if (
            storedUserId !==
            (await SecureStore.getItemAsync("user_id"))
          ) {
            await SecureStore.setItemAsync("user_id", storedUserId);
          }
        }
      } catch (error) {
        console.error("Unable to retrieve user ID:", error);
      }
    };

    loadUserId();

    return () => {
      cancelled = true;
    };
  }, [dataReturned?.sessionUser]);

  // Fetch the existing address once the user ID is available.
  const fetchAddress = useCallback(async () => {
    if (!userId) return;

    setLoadingAddress(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/address/getaddress?userId=${encodeURIComponent(userId)}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Unable to fetch address. HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data) {
        const addressData = data.userAddress ?? data;

        setUserAddress({
          number: String(addressData.number ?? ""),
          buildingName: addressData.buildingName ?? "",
          street: addressData.street ?? "",
          city: addressData.city ?? "",
          state: addressData.state ?? "",
          postalCode: String(addressData.postalCode ?? ""),
          description: addressData.description ?? "",
        });

        const latitude = Number(addressData.latitude);
        const longitude = Number(addressData.longitude);

        if (
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          (latitude !== 0 || longitude !== 0)
        ) {
          setAddressCoords({
            lat: latitude,
            lng: longitude,
          });
        }

        setSearchQuery(
          addressData.formattedAddress ??
            addressData.formatted ??
            ""
        );

        setDisableAddressInput(true);
      }
    } catch (error) {
      console.error("Error fetching address:", error);
    } finally {
      setLoadingAddress(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchAddress();
    }
  }, [userId, fetchAddress]);

  // Geoapify autocomplete, restricted to Nigeria.
  const fetchGeoapifySuggestions = async (query: string) => {
    if (!GEOAPIFY_API_KEY) {
      Alert.alert(
        "Missing API key",
        "The Geoapify API key could not be found. Check your .env.local file."
      );
      return;
    }

    try {
      const url =
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}` +
        `&filter=countrycode:ng&apiKey=${GEOAPIFY_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features?.length > 0) {
        setSuggestions(data.features);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("Geoapify lookup failed:", error);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (value.trim().length < 3 || disableAddressInput) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimer.current = setTimeout(() => {
      fetchGeoapifySuggestions(value.trim());
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, []);

  const handleSelectSuggestion = (feature: any) => {
    const props = feature.properties ?? {};

    setUserAddress({
      number: props.housenumber || "",
      buildingName:
        props.building ||
        props.name ||
        props.house_name ||
        props.complex ||
        "",
      street: props.street || props.address_line1 || "",
      city: props.city || props.suburb || props.county || "",
      state: props.state || "",
      postalCode: props.postcode || "",
      description: props.description || "",
    });

    if (props.lat != null && props.lon != null) {
      setAddressCoords({
        lat: Number(props.lat),
        lng: Number(props.lon),
      });
    }

    setSearchQuery(props.formatted || "");
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  // Save or edit the address.
  const handleSaveAddress = async () => {
    if (disableAddressInput) {
      setDisableAddressInput(false);
      return;
    }

    if (!userAddress.street.trim() || !userAddress.city.trim()) {
      Alert.alert(
        "Incomplete address",
        "Please provide at least a street and city."
      );
      return;
    }

    if (!addressCoords) {
      Alert.alert(
        "Address coordinates missing",
        "Please select an address from the Geoapify suggestions so its coordinates can be saved."
      );
      return;
    }

    setSavingAddress(true);

    const payload = {
      ...userAddress,
      number: parseInt(userAddress.number, 10) || 0,
      latitude: addressCoords.lat,
      longitude: addressCoords.lng,
    };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/address/saveaddress`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userAddress: payload,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Unable to save address. HTTP ${response.status}`);
      }

      const data = await response.json();

      if (response.status === 200 || response.status === 201) {
        Alert.alert(
          "Address saved",
          data.message || "Address successfully saved!"
        );

        await fetchAddress();
      } else {
        Alert.alert("Error", "Unable to save address.");
      }
    } catch (error) {
      console.error("Error saving address:", error);
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Unable to save address."
      );
    } finally {
      setSavingAddress(false);
    }
  };

  // Request the current device GPS coordinates.
  const getDeviceLocation = async (): Promise<Coordinates> => {
    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Location permission was not granted.");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    };
  };

  // Check device distance from the saved address.
  const isWithinRange = async (base64: string) => {
    if (!addressCoords) {
      Alert.alert(
        "Address required",
        "Please save an address with coordinates before taking evidence photos."
      );
      return false;
    }

    try {
      const currentDeviceCoords = await getDeviceLocation();
      setDeviceCoords(currentDeviceCoords);

      const response = await fetch(
        `${API_BASE_URL}/api/address/checkrange`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceCoords: currentDeviceCoords,
            addressCoords,
            doorPhoto: base64,
            gatePhoto: base64,
            facePhoto: base64,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Range check failed. HTTP ${response.status}`);
      }

      const data = await response.json();

      const distance = Number(data.range);

      if (!Number.isFinite(distance)) {
        throw new Error("The server returned an invalid distance.");
      }

      const rangeOffset = distance - 50;

      rangeRef.current = rangeOffset;
      setRange(rangeOffset);

      return Boolean(data.inRange);
    } catch (error) {
      console.error("Range verification failed:", error);

      Alert.alert(
        "Location verification failed",
        error instanceof Error
          ? error.message
          : "Please enable location services and try again."
      );

      return false;
    }
  };

  // Open the camera for a particular evidence photo.
  const openCamera = async (type: PhotoType) => {
    if (!addressCoords) {
      Alert.alert(
        "Address required",
        "Please save your address before taking evidence photos."
      );
      return;
    }

    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();

      if (!permission.granted) {
        Alert.alert(
          "Camera permission required",
          "Please allow camera access to take your evidence photo."
        );
        return;
      }
    }

    setActiveCamera(type);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || !activeCamera) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (!photo?.base64) {
        throw new Error("The camera did not return an image.");
      }

      const base64Image = `data:image/jpeg;base64,${photo.base64}`;
      const type = activeCamera;

      setActiveCamera(null);

      if (type === "gate") {
        setIsVerifyingGatePhoto(true);
      } else if (type === "door") {
        setIsVerifyingDoorPhoto(true);
      } else {
        setIsVerifyingFacePhoto(true);
      }

      const withinRange = await isWithinRange(base64Image);

      if (!withinRange) {
        Alert.alert(
          "Outside address range",
          `Please move closer to the address and try again. Range offset: ${rangeRef.current ?? "Unavailable"} metres.`
        );
        return;
      }

      if (type === "gate") {
        setGatePhoto(base64Image);
      } else if (type === "door") {
        setDoorPhoto(base64Image);
      } else {
        setFacePhoto(base64Image);
      }

      Alert.alert(
        "Location confirmed",
        `${type === "gate" ? "Gate" : type === "door" ? "Door" : "Face"} photo captured successfully.`
      );
    } catch (error) {
      console.error("Camera capture failed:", error);

      Alert.alert(
        "Camera error",
        error instanceof Error ? error.message : "Unable to capture photo."
      );
    } finally {
      setIsVerifyingGatePhoto(false);
      setIsVerifyingDoorPhoto(false);
      setIsVerifyingFacePhoto(false);
    }
  };

  // Upload an image as a signature.
  const handleSignatureUpload = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Please allow photo library access to upload your signature."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]?.base64) {
      const base64Data =
        `data:${result.assets[0].mimeType || "image/jpeg"};base64,` +
        result.assets[0].base64;

      await saveSignature(base64Data);
    }
  };

  // Save signature to the backend.
  const saveSignature = async (base64Data: string) => {
    setSavingSignature(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/address/savesignature`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signature: base64Data,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Signature upload failed. HTTP ${response.status}`);
      }

      const data = await response.json();

      if (response.ok && data === true) {
        setSignature(base64Data);
        setShowSignatureModal(false);

        Alert.alert(
          "Signature saved",
          data.message || "Signature saved successfully!"
        );
      } else {
        Alert.alert(
          "Signature not saved",
          data.message || "The server did not confirm the signature."
        );
      }
    } catch (error) {
      console.error("Error saving signature:", error);

      Alert.alert(
        "Signature error",
        error instanceof Error ? error.message : "Unable to save signature."
      );
    } finally {
      setSavingSignature(false);
    }
  };

  const handleSignatureOK = (signatureData: string) => {
    if (!signatureData) {
      Alert.alert("Signature required", "Please draw or upload a signature.");
      return;
    }

    saveSignature(signatureData);
  };

  const clearSignature = () => {
    signatureRef.current?.clearSignature();
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderInput = (
    placeholder: string,
    field: keyof AddressDetails,
    numeric = false,
    maxLength?: number
  ) => (
    <TextInput
      style={[
        styles.input,
        disableAddressInput && styles.disabledInput,
      ]}
      placeholder={placeholder}
      placeholderTextColor="#888"
      value={userAddress[field]}
      editable={!disableAddressInput}
      keyboardType={numeric ? "numeric" : "default"}
      maxLength={maxLength}
      onChangeText={(value) => {
        if (numeric) {
          value = value.replace(/[^0-9]/g, "");
        }

        updateAddressField(field, value);
      }}
    />
  );

  const photoButton = (
    type: PhotoType,
    label: string,
    photo: string,
    verifying: boolean
  ) => (
    <View style={styles.photoSection}>
      <TouchableOpacity
        style={[
          styles.primaryButton,
          verifying && styles.disabledButton,
        ]}
        disabled={verifying}
        onPress={() => openCamera(type)}
      >
        <Text style={styles.buttonText}>
          {verifying
            ? "Processing..."
            : photo
              ? `Retake ${label}`
              : `Take ${label}`}
        </Text>
      </TouchableOpacity>

      {verifying && (
        <ActivityIndicator
          style={styles.photoLoader}
          color="#008751"
          size="small"
        />
      )}

      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.photoPreview}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>CVT</Text>
            </View>

            <Text style={styles.headerTitle}>
              Check Verify Trust
            </Text>
          </View>

          {/* Address card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Address Verification</Text>

            <Text style={styles.cardInstruction}>
              Provide your Nigerian residential address and location details.
            </Text>

            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  addressVerified
                    ? styles.verifiedDot
                    : styles.unverifiedDot,
                ]}
              />
              <Text style={styles.statusText}>
                {addressVerified ? "Verified" : "Not Verified"}
              </Text>
            </View>

            {loadingAddress ? (
              <ActivityIndicator
                color="#008751"
                style={styles.loader}
              />
            ) : null}

            <Text style={styles.label}>Search Address</Text>

            <TextInput
              style={[
                styles.input,
                disableAddressInput && styles.disabledInput,
              ]}
              placeholder="Search Nigerian address..."
              placeholderTextColor="#888"
              value={searchQuery}
              editable={!disableAddressInput}
              onChangeText={handleSearchChange}
            />

            {showSuggestions && suggestions.length > 0 ? (
              <View style={styles.suggestionsContainer}>
                {suggestions.slice(0, 6).map((item, index) => (
                  <TouchableOpacity
                    key={`${item.properties?.place_id ?? index}`}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(item)}
                  >
                    <Text style={styles.suggestionText}>
                      {item.properties?.formatted}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>House Number</Text>
            {renderInput("House Number", "number", true, 4)}

            <Text style={styles.label}>Building Name / Apartment</Text>
            {renderInput("Building Name / Apartment", "buildingName")}

            <Text style={styles.label}>Street</Text>
            {renderInput("Street", "street")}

            <Text style={styles.label}>City</Text>
            {renderInput("City", "city")}

            <Text style={styles.label}>State</Text>
            {renderInput("State", "state")}

            <Text style={styles.label}>Postal Code</Text>
            {renderInput("Postal Code", "postalCode", true, 6)}

            <Text style={styles.label}>Address Description</Text>
            {renderInput("Describe your address", "description")}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                savingAddress && styles.disabledButton,
              ]}
              disabled={savingAddress || loadingAddress}
              onPress={handleSaveAddress}
            >
              {savingAddress ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {disableAddressInput ? "Edit Address" : "Save Address"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Photo evidence */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photo Evidence</Text>

            <Text style={styles.cardInstruction}>
              Capture photographs at your saved address. Your current GPS
              location will be checked against the address coordinates.
            </Text>

            {photoButton(
              "gate",
              "Gate Photo",
              gatePhoto,
              isVerifyingGatePhoto
            )}

            {photoButton(
              "door",
              "Door Photo",
              doorPhoto,
              isVerifyingDoorPhoto
            )}

            {photoButton(
              "face",
              "Face Photo",
              facePhoto,
              isVerifyingFacePhoto
            )}

            {range !== null ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Range offset: {range.toFixed(2)} metres
                </Text>
              </View>
            ) : null}

            {deviceCoords ? (
              <Text style={styles.coordinateText}>
                GPS location: {deviceCoords.lat.toFixed(6)},{" "}
                {deviceCoords.lng.toFixed(6)}
              </Text>
            ) : null}
          </View>

          {/* Signature */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Signature</Text>

            <Text style={styles.cardInstruction}>
              Draw your signature or upload an existing signature image.
            </Text>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (isVerifyingFacePhoto ||
                  isVerifyingDoorPhoto ||
                  isVerifyingGatePhoto) &&
                  styles.disabledButton,
              ]}
              disabled={
                isVerifyingFacePhoto ||
                isVerifyingDoorPhoto ||
                isVerifyingGatePhoto
              }
              onPress={() => setShowSignatureModal(true)}
            >
              <Text style={styles.buttonText}>
                {signature ? "Change Signature" : "Capture Signature"}
              </Text>
            </TouchableOpacity>

            {signature ? (
              <View style={styles.signaturePreviewContainer}>
                <Text style={styles.label}>
                  Captured Signature Preview
                </Text>

                <Image
                  source={{ uri: signature }}
                  style={styles.signaturePreview}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
            >
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Camera modal */}
      <Modal
        visible={activeCamera !== null}
        animationType="slide"
        onRequestClose={() => setActiveCamera(null)}
      >
        <SafeAreaView style={styles.cameraModal}>
          <Text style={styles.cameraTitle}>
            {activeCamera === "gate"
              ? "Capture Gate Photo"
              : activeCamera === "door"
                ? "Capture Door Photo"
                : "Capture Face Photo"}
          </Text>

          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          />

          <View style={styles.cameraActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setActiveCamera(null)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureButton}
              onPress={capturePhoto}
            >
              <Text style={styles.buttonText}>Capture</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Signature modal */}
      <Modal
        visible={showSignatureModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSignatureModal(false)}
      >
        <View style={styles.signatureModalOverlay}>
          <View style={styles.signatureModal}>
            <Text style={styles.signatureTitle}>
              Record Your Signature
            </Text>

            <Text style={styles.cardInstruction}>
              Sign below or upload an image backup.
            </Text>

            <View style={styles.signaturePad}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureOK}
                onEmpty={() =>
                  Alert.alert(
                    "Signature required",
                    "Please draw your signature first."
                  )
                }
                autoClear={false}
                descriptionText=""
                clearText="Clear"
                confirmText="Save"
                webStyle={`
                  .m-signature-pad {
                    box-shadow: none;
                    border: none;
                  }
                  .m-signature-pad--body {
                    border: 2px dashed #bbb;
                    background-color: #fafafa;
                  }
                  .m-signature-pad--footer {
                    display: none;
                  }
                  body, html {
                    width: 100%;
                    height: 100%;
                  }
                `}
              />
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={clearSignature}
            >
              <Text style={styles.secondaryButtonText}>
                Clear Pad
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSignatureUpload}
            >
              <Text style={styles.secondaryButtonText}>
                Upload Image
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                savingSignature && styles.disabledButton,
              ]}
              disabled={savingSignature}
              onPress={() => signatureRef.current?.readSignature()}
            >
              {savingSignature ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Save Signature</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowSignatureModal(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F9F9F9",
    color: "#333",
    fontSize: 15,
    marginBottom: 4,
  },
  disabledInput: {
    backgroundColor: "#EEEEEE",
    color: "#777",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  verifiedDot: {
    backgroundColor: "#008751",
  },
  unverifiedDot: {
    backgroundColor: "#B22222",
  },
  statusText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    backgroundColor: "#FFF",
    marginBottom: 8,
    overflow: "hidden",
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  suggestionText: {
    fontSize: 13,
    color: "#333",
  },
  primaryButton: {
    backgroundColor: "#008751",
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  disabledButton: {
    opacity: 0.55,
  },
  loader: {
    marginVertical: 15,
  },
  photoSection: {
    marginTop: 8,
  },
  photoLoader: {
    marginTop: 10,
  },
  photoPreview: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: "#EEE",
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    backgroundColor: "#F9F9F9",
  },
  infoText: {
    color: "#333",
    fontSize: 14,
  },
  coordinateText: {
    color: "#666",
    fontSize: 11,
    marginTop: 8,
  },
  signaturePreviewContainer: {
    alignItems: "center",
    marginTop: 12,
  },
  signaturePreview: {
    width: 200,
    height: 90,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 6,
    backgroundColor: "#FFF",
  },
  footer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#B22222",
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
  },
  cameraModal: {
    flex: 1,
    backgroundColor: "#0A2E1D",
    padding: 16,
  },
  cameraTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    paddingVertical: 16,
  },
  camera: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  cameraActions: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 18,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#B22222",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  captureButton: {
    flex: 1,
    backgroundColor: "#008751",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
  },
  signatureModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 16,
  },
  signatureModal: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 18,
  },
  signatureTitle: {
    color: "#222",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  signaturePad: {
    height: 220,
    marginTop: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#374151",
    fontWeight: "600",
  },
});
