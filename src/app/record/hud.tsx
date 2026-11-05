import { router } from 'expo-router';

import { Placeholder } from '@/components/Placeholder';

export default function HudScreen() {
  return <Placeholder title="Driving HUD" note="Built in task 1.5." onBack={() => router.back()} />;
}
