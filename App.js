import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import ConfirmUserDetails from './screens/ConfirmUserDetails';
import UserProfilePage from './screens/UserProfilePage';
import OTPs from './screens/OTPs';
import Address from './screens/Address';
import DocumentUpload from './screens/DocumentUpload';
import MyProfile from './screens/MyProfile';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="ConfirmUserDetails" component={ConfirmUserDetails} />
        <Stack.Screen name="UserProfilePage" component={UserProfilePage} />
        <Stack.Screen name="OTPs" component={OTPs} />
        <Stack.Screen name="Address" component={Address} />
        <Stack.Screen name="DocumentUpload" component={DocumentUpload} />
        <Stack.Screen name="MyProfile" component={MyProfile} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}