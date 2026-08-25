import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RoleShellScreen from '../screens/RoleShellScreen';
import AccessDeniedScreen from '../screens/AccessDeniedScreen';
import OfflineScreen from '../screens/OfflineScreen';
import MandatoryUpgradeScreen from '../screens/MandatoryUpgradeScreen';
import LoadingScreen from '../screens/LoadingScreen';

// Sales Screens
import SalesDashboardScreen from '../screens/sales/SalesDashboardScreen';
import CustomerDetailScreen from '../screens/sales/CustomerDetailScreen';
import CreateCustomerScreen from '../screens/sales/CreateCustomerScreen';
import CreateLeadScreen from '../screens/sales/CreateLeadScreen';

// Fleet Screens
import FleetDashboardScreen from '../screens/fleet/FleetDashboardScreen';
import FleetScheduleScreen from '../screens/fleet/FleetScheduleScreen';
import FleetExceptionsScreen from '../screens/fleet/FleetExceptionsScreen';
import CopilotOverrideScreen from '../screens/fleet/CopilotOverrideScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: true }}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RoleShell" component={RoleShellScreen} options={{ title: 'Dashboard' }} />
        <Stack.Screen name="AccessDenied" component={AccessDeniedScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Offline" component={OfflineScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MandatoryUpgrade" component={MandatoryUpgradeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Loading" component={LoadingScreen} options={{ headerShown: false }} />
        
        {/* Sales Stack */}
        <Stack.Screen name="SalesDashboard" component={SalesDashboardScreen} options={{ title: 'Customers' }} />
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer Details' }} />
        <Stack.Screen name="CreateCustomer" component={CreateCustomerScreen} options={{ title: 'New Customer' }} />
        <Stack.Screen name="CreateLead" component={CreateLeadScreen} options={{ title: 'New Lead' }} />
        
        {/* Fleet Stack */}
        <Stack.Screen name="FleetDashboard" component={FleetDashboardScreen} options={{ title: 'Fleet Operations' }} />
        <Stack.Screen name="FleetSchedule" component={FleetScheduleScreen} options={{ title: 'Daily Schedule' }} />
        <Stack.Screen name="FleetExceptions" component={FleetExceptionsScreen} options={{ title: 'Live Exceptions' }} />
        <Stack.Screen name="CopilotOverride" component={CopilotOverrideScreen} options={{ title: 'Copilot Override' }} />

        {/* Admin Stack */}
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin Controls' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
