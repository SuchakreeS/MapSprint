import { Tabs } from 'expo-router';

import { RecordTabButton } from '@/components/RecordTabButton';
import { useTheme } from '@/theme/use-theme';

export default function TabsLayout() {
  const { c, fonts } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        tabBarIconStyle: { display: 'none' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="world" options={{ title: 'Map' }} />
      <Tabs.Screen name="start" options={{ title: 'Record', tabBarButton: () => <RecordTabButton /> }} />
      <Tabs.Screen name="ranks" options={{ title: 'Ranks' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
