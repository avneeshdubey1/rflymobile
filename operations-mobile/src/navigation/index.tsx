import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RoleShellScreen from '../screens/RoleShellScreen';
import AccessDeniedScreen from '../screens/AccessDeniedScreen';
import OfflineScreen from '../screens/OfflineScreen';
import MandatoryUpgradeScreen from '../screens/MandatoryUpgradeScreen';
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="RoleShell" component={RoleShellScreen} />
        <Stack.Screen name="AccessDenied" component={AccessDeniedScreen} />
        <Stack.Screen name="Offline" component={OfflineScreen} />
        <Stack.Screen name="MandatoryUpgrade" component={MandatoryUpgradeScreen} />
        <Stack.Screen name="Loading" component={LoadingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
