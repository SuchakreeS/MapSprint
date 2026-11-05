import { router } from 'expo-router';

import { Placeholder } from '@/components/Placeholder';

export default function RecapScreen() {
  return <Placeholder title="Recap" note="Built in task 1.7." onBack={() => router.back()} />;
}
