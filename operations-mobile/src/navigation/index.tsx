import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth';
import { setAuthInterceptors } from '../api/client';
import { authApi } from '../api/auth';

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
import TeamManagementScreen from '../screens/admin/TeamManagementScreen';
import AssetManagementScreen from '../screens/admin/AssetManagementScreen';
import RegionManagementScreen from '../screens/admin/RegionManagementScreen';
import PolicyManagementScreen from '../screens/admin/PolicyManagementScreen';
import MasterDataManagementScreen from '../screens/admin/MasterDataManagementScreen';

// Farmer Screens
import FarmerPhoneScreen from '../screens/farmer/FarmerPhoneScreen';
import FarmerOTPScreen from '../screens/farmer/FarmerOTPScreen';
import FarmerDashboardScreen from '../screens/farmer/FarmerDashboardScreen';
import ServiceRequestWizard from '../screens/farmer/ServiceRequestWizard';

// Business Screens
import BusinessLoginScreen from '../screens/business/BusinessLoginScreen';
import BusinessDashboardScreen from '../screens/business/BusinessDashboardScreen';
import LinkedRequestListScreen from '../screens/business/LinkedRequestListScreen';
import LinkedRequestDetailScreen from '../screens/business/LinkedRequestDetailScreen';
import NotificationsScreen from '../screens/business/NotificationsScreen';
import ProfileScreen from '../screens/business/ProfileScreen';

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef<any>();

export default function AppNavigator() {
  const { isHydrated, hydrate, token, profile, capabilities, logout, setProfile } = useAuthStore();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  
  useEffect(() => {
    setAuthInterceptors(
      () => {
        void logout();
      },
      () => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('MandatoryUpgrade');
        }
      }
    );
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      const storedToken = await hydrate();
      if (storedToken) {
        try {
          const bootstrap = await authApi.bootstrap();
          setProfile(bootstrap.profile, bootstrap.capabilities);
        } catch (_error) {
          await logout();
        }
      }
      setIsBootstrapping(false);
    };
    init();
  }, [hydrate, logout, setProfile]);

  if (!isHydrated || isBootstrapping) {
    return <LoadingScreen />;
  }

  const role = profile?.role;
  const initialRoute = !token
    ? 'Login'
    : role === 'FARMER'
      ? 'FarmerDashboard'
      : role === 'BUSINESS'
        ? 'BusinessDashboard'
        : ['ADMIN', 'FLEET_MANAGER', 'SALES'].includes(role || '')
          ? 'RoleShell'
          : 'AccessDenied';

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator key={`${token ? role : 'guest'}-navigator`} initialRouteName={initialRoute} screenOptions={{ headerShown: true }}>
        {!token && <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="FarmerPhone" component={FarmerPhoneScreen} options={{ title: 'Farmer Login' }} />
          <Stack.Screen name="FarmerOTP" component={FarmerOTPScreen} options={{ title: 'Verify OTP' }} />
          <Stack.Screen name="BusinessLogin" component={BusinessLoginScreen} options={{ title: 'Business Login' }} />
        </>}

        {token && profile?.role === 'FARMER' && <>
          <Stack.Screen name="FarmerDashboard" component={FarmerDashboardScreen} options={{ title: 'Farmer Dashboard' }} />
          <Stack.Screen name="ServiceRequestWizard" component={ServiceRequestWizard} options={{ title: 'New Request' }} />
        </>}

        {token && profile?.role === 'BUSINESS' && <>
          <Stack.Screen name="BusinessDashboard" component={BusinessDashboardScreen} options={{ title: 'B2B Dashboard' }} />
          <Stack.Screen name="LinkedRequestList" component={LinkedRequestListScreen} options={{ title: 'Linked Requests' }} />
          <Stack.Screen name="LinkedRequestDetail" component={LinkedRequestDetailScreen} options={{ title: 'Request Detail' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Organization Profile' }} />
        </>}

        {token && ['ADMIN', 'FLEET_MANAGER', 'SALES'].includes(profile?.role || '') && <>
          <Stack.Screen name="RoleShell" component={RoleShellScreen} options={{ title: 'Dashboard' }} />
          {capabilities.includes('SALES_INTAKE') && <>
            <Stack.Screen name="SalesDashboard" component={SalesDashboardScreen} options={{ title: 'Customers' }} />
            <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer Details' }} />
            <Stack.Screen name="CreateCustomer" component={CreateCustomerScreen} options={{ title: 'New Customer' }} />
            <Stack.Screen name="CreateLead" component={CreateLeadScreen} options={{ title: 'New Lead' }} />
          </>}
          {capabilities.includes('FLEET_SCHEDULE') && <>
            <Stack.Screen name="FleetDashboard" component={FleetDashboardScreen} options={{ title: 'Fleet Operations' }} />
            <Stack.Screen name="FleetSchedule" component={FleetScheduleScreen} options={{ title: 'Daily Schedule' }} />
            <Stack.Screen name="FleetExceptions" component={FleetExceptionsScreen} options={{ title: 'Live Exceptions' }} />
          </>}
          {profile?.role === 'ADMIN' && <>
            <Stack.Screen name="CopilotOverride" component={CopilotOverrideScreen} options={{ title: 'Copilot Override' }} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin Controls' }} />
            <Stack.Screen name="TeamManagement" component={TeamManagementScreen} options={{ title: 'Team Directory' }} />
            <Stack.Screen name="AssetManagement" component={AssetManagementScreen} options={{ title: 'Assets & Drones' }} />
            <Stack.Screen name="RegionManagement" component={RegionManagementScreen} options={{ title: 'Feasible Regions' }} />
            <Stack.Screen name="PolicyManagement" component={PolicyManagementScreen} options={{ title: 'Assignment Policy' }} />
            <Stack.Screen name="MasterDataManagement" component={MasterDataManagementScreen} options={{ title: 'Master Data' }} />
          </>}
        </>}

        {token && profile && !['ADMIN', 'FLEET_MANAGER', 'SALES', 'FARMER', 'BUSINESS'].includes(profile.role) &&
          <Stack.Screen name="AccessDenied" component={AccessDeniedScreen} options={{ headerShown: false }} />}
        {token && <Stack.Screen name="Offline" component={OfflineScreen} options={{ headerShown: false }} />}
        <Stack.Screen name="MandatoryUpgrade" component={MandatoryUpgradeScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
