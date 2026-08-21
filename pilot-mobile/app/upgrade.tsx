import { View, Text } from "react-native";

export default function UpgradeScreen() {
  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950 items-center justify-center p-6">
      <View className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 items-center">
        <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-4 text-center">
          Update Required
        </Text>
        <Text className="text-slate-600 dark:text-slate-400 text-center text-lg leading-relaxed mb-2">
          Your version of the Pilot Field app is no longer supported by the
          servers.
        </Text>
        <Text className="text-slate-600 dark:text-slate-400 text-center text-lg leading-relaxed">
          Please download the latest update from your device management portal
          to continue working.
        </Text>
      </View>
    </View>
  );
}
