import { LockedFeature } from '@/components/LockedFeature';
import { Placeholder } from '@/components/Placeholder';
import { useAuth } from '@/features/auth/auth-provider';

export default function RanksTab() {
  const { guest } = useAuth();
  if (guest) return <LockedFeature title="Ranks" pitch="Climb the weekly boards for distance, exploring and smooth driving." />;
  return <Placeholder title="Ranks" note="Leaderboards arrive in Phase 4." />;
}
