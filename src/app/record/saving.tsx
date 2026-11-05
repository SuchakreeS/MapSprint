import { router } from 'expo-router';

import { Placeholder } from '@/components/Placeholder';

export default function SavingScreen() {
  return <Placeholder title="Saving" note="Built in task 1.7." onBack={() => router.back()} />;
}
