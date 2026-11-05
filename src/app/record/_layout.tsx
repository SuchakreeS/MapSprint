import { Stack } from 'expo-router';

export default function RecordLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The HUD can only be left with Hold to finish. */}
      <Stack.Screen name="hud" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
