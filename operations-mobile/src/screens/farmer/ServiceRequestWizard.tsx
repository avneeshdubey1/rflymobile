import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { farmerApi } from '../../api/farmer';
import { t } from '../../i18n/farmer';

export default function ServiceRequestWizard({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [requestData, setRequestData] = useState({
    crop: '',
    area: '',
    location: { lat: 0, lng: 0, plusCode: '' },
    preferredWindow: ''
  });

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await farmerApi.submitRequest(requestData);
      if (res.success) {
        Alert.alert('Success', t('success'));
        navigation.goBack();
      } else {
        Alert.alert('Declined', res.error?.message || t('declined'));
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = () => {
    // In a real app, save to AsyncStorage/SQLite
    Alert.alert('Draft Saved', t('draftSaved'));
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.header}>{t('step1')}</Text>
            <Text style={styles.label}>Crop</Text>
            <TextInput style={styles.input} value={requestData.crop} onChangeText={(v) => setRequestData({...requestData, crop: v})} />
            <Text style={styles.label}>Area (Acres)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={requestData.area} onChangeText={(v) => setRequestData({...requestData, area: v})} />
            <Button title="Next" color={colors.navy} onPress={handleNext} disabled={!requestData.crop || !requestData.area} />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.header}>{t('step2')}</Text>
            <Text style={styles.label}>Plus Code (Map Pin)</Text>
            <TextInput style={styles.input} placeholder="e.g. 7J34+XQ" value={requestData.location.plusCode} onChangeText={(v) => setRequestData({...requestData, location: {...requestData.location, plusCode: v}})} />
            <View style={styles.row}>
              <Button title="Back" color={colors.darkGrey} onPress={handleBack} />
              <Button title="Next" color={colors.navy} onPress={handleNext} disabled={!requestData.location.plusCode} />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.header}>{t('step3')}</Text>
            <Text style={styles.label}>Preferred Window (Dates)</Text>
            <TextInput style={styles.input} value={requestData.preferredWindow} onChangeText={(v) => setRequestData({...requestData, preferredWindow: v})} />
            <View style={styles.row}>
              <Button title="Back" color={colors.darkGrey} onPress={handleBack} />
              <Button title="Next" color={colors.navy} onPress={handleNext} disabled={!requestData.preferredWindow} />
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.header}>{t('step4')}</Text>
            <Text style={styles.detail}>Crop: {requestData.crop}</Text>
            <Text style={styles.detail}>Area: {requestData.area} Acres</Text>
            <Text style={styles.detail}>Location: {requestData.location.plusCode}</Text>
            <Text style={styles.detail}>Window: {requestData.preferredWindow}</Text>
            
            <View style={styles.row}>
              <Button title="Back" color={colors.darkGrey} onPress={handleBack} />
              {loading ? (
                <ActivityIndicator color={colors.safetyOrange} />
              ) : (
                <Button title={t('submit')} color={colors.safetyOrange} onPress={handleSubmit} />
              )}
            </View>
            <View style={{ marginTop: spacing.xl }}>
              <Button title="Save as Draft" color={colors.darkGrey} onPress={saveDraft} />
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
