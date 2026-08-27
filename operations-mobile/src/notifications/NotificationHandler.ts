import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const NotificationHandler = {
  configure() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('operations-updates', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  },
  
  parseIncoming(notification: Notifications.Notification) {
    const { data } = notification.request.content;
    
    // Check if it maps to OC-01 schema (e.g., contains standard operations payload)
    if (!data || typeof data.requestId !== 'string' || typeof data.type !== 'string') return null;
    return { requestId: data.requestId, type: data.type };
  }
};
