import { router } from 'expo-router';

import { Placeholder } from '@/components/Placeholder';

export default function PreDriveScreen() {
  return <Placeholder title="Pre-drive check" note="Built in task 1.4." onBack={() => router.back()} />;
}
