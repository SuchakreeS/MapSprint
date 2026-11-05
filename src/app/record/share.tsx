import { router } from 'expo-router';

import { Placeholder } from '@/components/Placeholder';

export default function ShareScreen() {
  return <Placeholder title="Share" note="Built in Phase 4." onBack={() => router.back()} />;
}
