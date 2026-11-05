import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DriveInProgressBanner } from '@/components/DriveInProgressBanner';
import { RecordTabButton } from '@/components/RecordTabButton';
import { useTheme } from '@/theme/use-theme';

export default function TabsLayout() {
  const { c, fonts } = useTheme();
  return (
    <View style={styles.fill}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
          tabBarActiveTintColor: c.primaryText,
          tabBarInactiveTintColor: c.muted,
          // Active label is bold, inactive semibold (design/source/KitTabBar.dc.html).
          tabBarLabel: ({ focused, color, children }) => (
            <Text
              style={{ color, fontSize: 12, fontFamily: focused ? fonts.bodyBold : fonts.bodyMedium }}>
              {children}
            </Text>
          ),
          tabBarIconStyle: { display: 'none' },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Feed' }} />
        <Tabs.Screen name="world" options={{ title: 'Map' }} />
        <Tabs.Screen name="start" options={{ title: 'Record', tabBarButton: () => <RecordTabButton /> }} />
        <Tabs.Screen name="ranks" options={{ title: 'Ranks' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      <DriveInProgressBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
