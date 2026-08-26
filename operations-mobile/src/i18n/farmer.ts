export const farmerTranslations = {
  en: {
    welcome: 'Welcome Farmer',
    phonePrompt: 'Enter your mobile number to receive an OTP.',
    requestOtp: 'Request OTP',
    verifyOtp: 'Verify OTP',
    enterCode: 'Enter the 6-digit code',
    dashboard: 'My Dashboard',
    newRequest: 'New Service Request',
    step1: 'Step 1: Service & Crop',
    step2: 'Step 2: Location',
    step3: 'Step 3: Preferred Window',
    step4: 'Step 4: Review',
    step5: 'Step 5: Status',
    submit: 'Submit Request',
    success: 'Request Accepted',
    declined: 'Request Declined (Geofence)',
    draftSaved: 'Draft saved locally',
    history: 'Service History',
    noHistory: 'No past services found.',
  }
};

export function t(key: keyof typeof farmerTranslations.en) {
  return farmerTranslations.en[key] || key;
}
