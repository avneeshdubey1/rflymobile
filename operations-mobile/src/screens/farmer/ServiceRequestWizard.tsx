import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing } from '../../theme/tokens';
import { farmerApi } from '../../api/farmer';
import { masterDataApi, MasterChoice } from '../../api/masterData';
import { t } from '../../i18n/farmer';

export default function ServiceRequestWizard({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [crops, setCrops] = useState<MasterChoice[]>([]);
  const [requestData, setRequestData] = useState({
    cropType: '',
    acreage: '',
    latitude: '',
    longitude: '',
    farmerAddress: '',
    notes: ''
  });

  useEffect(() => {
    masterDataApi.getChoices()
      .then(({ data }) => setCrops(data.crops))
      .catch((error) => Alert.alert('Crop list unavailable', error.message || 'Refresh and try again.'));
  }, []);

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const useCurrentLocation = async () => {
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location permission required', 'Allow location only while selecting this farm location.');
        return;
      }
      const result = await Location.getCurrentPositionAsync({});
      setRequestData((current) => ({
        ...current,
        latitude: result.coords.latitude.toFixed(6),
        longitude: result.coords.longitude.toFixed(6),
      }));
    } catch (_error) {
      Alert.alert('Location unavailable', 'Turn on device location and try again.');
    } finally {
      setLoading(false);
    }
  };

  const resolveAddress = async () => {
    if (!requestData.farmerAddress.trim()) {
      Alert.alert('Farm location required', 'Enter a village, address, or full Plus Code.');
      return;
    }
    setLoading(true);
    try {
      const matches = await Location.geocodeAsync(requestData.farmerAddress.trim());
      if (!matches.length) {
        Alert.alert('Location not found', 'Check the address or full Plus Code and try again.');
        return;
      }
      setRequestData((current) => ({
        ...current,
        latitude: matches[0].latitude.toFixed(6),
        longitude: matches[0].longitude.toFixed(6),
      }));
    } catch (_error) {
      Alert.alert('Location not found', 'This device could not resolve that address or Plus Code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const acreage = Number(requestData.acreage);
    const latitude = Number(requestData.latitude);
    const longitude = Number(requestData.longitude);
    if (!requestData.cropType || !Number.isFinite(acreage) || acreage <= 0
      || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Check request', 'Choose a crop, enter a positive acreage, and confirm the farm location.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        cropType: requestData.cropType,
        acreage,
        latitude,
        longitude,
        farmerAddress: requestData.farmerAddress,
        notes: requestData.notes
      };
      
      const res: any = await farmerApi.submitRequest(payload);
      if (res.success) {
        Alert.alert('Success', t('success'));
        navigation.goBack();
      } else {
        Alert.alert('Declined', res.error?.message || t('declined'));
      }
    } catch (err: any) {
      if (err.data?.error?.code === 'OUTSIDE_SERVICE_AREA') {
        Alert.alert('Declined', t('declined'));
      } else {
        Alert.alert('Error', err.data?.error?.message || 'Submission failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView testID="wizard-scroll">
        {step === 1 && (
          <View style={styles.stepContainer} testID="step-1">
            <Text style={styles.header}>{t('step1')}</Text>
            
            <Text style={styles.label}>{t('cropLabel')}</Text>
            <View style={styles.choiceGroup} testID="crop-choices">
              {crops.map((crop) => (
                <TouchableOpacity
                  key={crop.id}
                  style={[styles.choice, requestData.cropType === crop.displayName && styles.choiceSelected]}
                  onPress={() => setRequestData({ ...requestData, cropType: crop.displayName })}
                >
                  <Text style={requestData.cropType === crop.displayName ? styles.choiceTextSelected : styles.choiceText}>
                    {crop.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.label}>{t('areaLabel')}</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={requestData.acreage} onChangeText={(v) => setRequestData({...requestData, acreage: v})} testID="input-area" />
            
            <Button title={t('next')} color={colors.navy} onPress={handleNext} disabled={!requestData.cropType || !requestData.acreage} testID="btn-next-1" />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer} testID="step-2">
            <Text style={styles.header}>{t('step2')}</Text>

            <Text style={styles.label}>{t('addressLabel')}</Text>
            <TextInput
              style={styles.input}
              value={requestData.farmerAddress}
              onChangeText={(v) => setRequestData({ ...requestData, farmerAddress: v })}
              placeholder="Village/address or full Plus Code"
              testID="input-address"
            />
            <Button title="Resolve Address / Plus Code" color={colors.navy} onPress={resolveAddress} testID="btn-resolve-location" />
            <View style={{ height: spacing.sm }} />
            <Button title="Use Current Device Location" color={colors.darkGrey} onPress={useCurrentLocation} testID="btn-current-location" />
            <Text style={styles.coordinate} testID="resolved-coordinates">
              {requestData.latitude && requestData.longitude
                ? `${requestData.latitude}, ${requestData.longitude}`
                : 'No location selected'}
            </Text>
            
            <View style={styles.row}>
              <Button title={t('back')} color={colors.darkGrey} onPress={handleBack} testID="btn-back-2" />
              <Button title={t('next')} color={colors.navy} onPress={handleNext} disabled={!requestData.latitude || !requestData.longitude || !requestData.farmerAddress.trim()} testID="btn-next-2" />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer} testID="step-3">
            <Text style={styles.header}>{t('step3')}</Text>
            
            <Text style={styles.label}>{t('notesLabel')}</Text>
            <TextInput style={[styles.input, { height: 80 }]} multiline value={requestData.notes} onChangeText={(v) => setRequestData({...requestData, notes: v})} testID="input-notes" />
            
            <View style={styles.row}>
              <Button title={t('back')} color={colors.darkGrey} onPress={handleBack} testID="btn-back-3" />
              <Button title={t('next')} color={colors.navy} onPress={handleNext} testID="btn-next-3" />
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer} testID="step-4">
            <Text style={styles.header}>{t('step4')}</Text>
            
            <Text style={styles.detail}>{t('cropLabel')}: {requestData.cropType}</Text>
            <Text style={styles.detail}>{t('areaLabel')}: {requestData.acreage}</Text>
            <Text style={styles.detail}>{t('latLabel')}: {requestData.latitude}</Text>
            <Text style={styles.detail}>{t('lngLabel')}: {requestData.longitude}</Text>
            <Text style={styles.detail}>{t('addressLabel')}: {requestData.farmerAddress}</Text>
            
            <View style={[styles.row, { marginTop: spacing.xl }]}>
              <Button title={t('back')} color={colors.darkGrey} onPress={handleBack} testID="btn-back-4" />
              {loading ? (
                <ActivityIndicator color={colors.safetyOrange} testID="loading-indicator" />
              ) : (
                <Button title={t('submit')} color={colors.safetyOrange} onPress={handleSubmit} testID="btn-submit" />
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  stepContainer: { padding: spacing.xl },
  header: { fontSize: 22, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xl },
  label: { fontSize: 16, color: colors.navy, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.lightGrey, borderRadius: 8, padding: spacing.md, marginBottom: spacing.lg, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  detail: { fontSize: 16, color: colors.darkGrey, marginBottom: spacing.sm },
  coordinate: { color: colors.navy, marginVertical: spacing.md },
  choiceGroup: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg, gap: spacing.sm },
  choice: { borderWidth: 1, borderColor: colors.navy, borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceSelected: { backgroundColor: colors.navy },
  choiceText: { color: colors.navy },
  choiceTextSelected: { color: colors.white, fontWeight: 'bold' },
});
