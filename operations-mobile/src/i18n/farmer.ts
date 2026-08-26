export const farmerTranslations = {
  en: {
    welcome: 'Welcome',
    phonePrompt: 'Enter your mobile number to receive an OTP.',
    requestOtp: 'Request OTP',
    verifyOtp: 'Verify OTP',
    enterCode: 'Enter the 6-digit code',
    dashboard: 'My Dashboard',
    newRequest: 'New Service Request',
    step1: 'Step 1: Crop & Area',
    step2: 'Step 2: Location',
    step3: 'Step 3: Details',
    step4: 'Step 4: Review',
    submit: 'Submit Request',
    success: 'Request Accepted',
    declined: 'Request Declined (Geofence)',
    history: 'Service History',
    noHistory: 'No past services found.',
    cropLabel: 'Crop Type',
    areaLabel: 'Area (Acres)',
    latLabel: 'Latitude',
    lngLabel: 'Longitude',
    addressLabel: 'Farm Address / Village',
    notesLabel: 'Notes',
    next: 'Next',
    back: 'Back'
  },
  te: {
    welcome: 'స్వాగతం',
    phonePrompt: 'OTP పొందడానికి మీ మొబైల్ నంబర్‌ను నమోదు చేయండి.',
    requestOtp: 'OTP అభ్యర్థించండి',
    verifyOtp: 'OTP నిర్ధారించండి',
    enterCode: '6-అంకెల కోడ్‌ను నమోదు చేయండి',
    dashboard: 'నా డాష్‌బోర్డ్',
    newRequest: 'కొత్త సర్వీస్ అభ్యర్థన',
    step1: 'దశ 1: పంట & విస్తీర్ణం',
    step2: 'దశ 2: స్థానం',
    step3: 'దశ 3: వివరాలు',
    step4: 'దశ 4: సమీక్ష',
    submit: 'అభ్యర్థన పంపండి',
    success: 'అభ్యర్థన అంగీకరించబడింది',
    declined: 'అభ్యర్థన తిరస్కరించబడింది (జియోఫెన్స్)',
    history: 'సేవల చరిత్ర',
    noHistory: 'గత సేవలు కనుగొనబడలేదు.',
    cropLabel: 'పంట రకం',
    areaLabel: 'విస్తీర్ణం (ఎకరాలు)',
    latLabel: 'అక్షాంశం',
    lngLabel: 'రేఖాంశం',
    addressLabel: 'పొలం చిరునామా / గ్రామం',
    notesLabel: 'గమనికలు',
    next: 'తరువాత',
    back: 'వెనుకకు'
  }
};

let currentLang = 'en';

export function setLanguage(lang: 'en' | 'te') {
  currentLang = lang;
}

export function t(key: keyof typeof farmerTranslations.en) {
  // @ts-ignore
  return farmerTranslations[currentLang]?.[key] || farmerTranslations.en[key] || key;
}
