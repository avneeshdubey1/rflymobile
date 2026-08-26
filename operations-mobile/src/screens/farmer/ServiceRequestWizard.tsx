import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { farmerApi } from '../../api/farmer';
import { t } from '../../i18n/farmer';

export default function ServiceRequestWizard({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [requestData, setRequestData] = useState({
    cropType: '',
    acreage: '',
    latitude: '',
    longitude: '',
    farmerAddress: '',
    notes: ''
  });

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        cropType: requestData.cropType,
        acreage: parseFloat(requestData.acreage) || 0,
        latitude: parseFloat(requestData.latitude) || 0,
        longitude: parseFloat(requestData.longitude) || 0,
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
            <TextInput style={styles.input} value={requestData.cropType} onChangeText={(v) => setRequestData({...requestData, cropType: v})} testID="input-crop" />
            
            <Text style={styles.label}>{t('areaLabel')}</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={requestData.acreage} onChangeText={(v) => setRequestData({...requestData, acreage: v})} testID="input-area" />
            
            <Button title={t('next')} color={colors.navy} onPress={handleNext} disabled={!requestData.cropType || !requestData.acreage} testID="btn-next-1" />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer} testID="step-2">
            <Text style={styles.header}>{t('step2')}</Text>
            
            <Text style={styles.label}>{t('latLabel')}</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={requestData.latitude} onChangeText={(v) => setRequestData({...requestData, latitude: v})} testID="input-lat" />
            
            <Text style={styles.label}>{t('lngLabel')}</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={requestData.longitude} onChangeText={(v) => setRequestData({...requestData, longitude: v})} testID="input-lng" />
            
            <View style={styles.row}>
              <Button title={t('back')} color={colors.darkGrey} onPress={handleBack} testID="btn-back-2" />
              <Button title={t('next')} color={colors.navy} onPress={handleNext} disabled={!requestData.latitude || !requestData.longitude} testID="btn-next-2" />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer} testID="step-3">
            <Text style={styles.header}>{t('step3')}</Text>
            
            <Text style={styles.label}>{t('addressLabel')}</Text>
            <TextInput style={styles.input} value={requestData.farmerAddress} onChangeText={(v) => setRequestData({...requestData, farmerAddress: v})} testID="input-address" />
            
            <Text style={styles.label}>{t('notesLabel')}</Text>
            <TextInput style={[styles.input, { height: 80 }]} multiline value={requestData.notes} onChangeText={(v) => setRequestData({...requestData, notes: v})} testID="input-notes" />
            
            <View style={styles.row}>
              <Button title={t('back')} color={colors.darkGrey} onPress={handleBack} testID="btn-back-3" />
              <Button title={t('next')} color={colors.navy} onPress={handleNext} disabled={!requestData.farmerAddress} testID="btn-next-3" />
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
  detail: { fontSize: 16, color: colors.darkGrey, marginBottom: spacing.sm }
});
