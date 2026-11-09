import { LockedFeature } from '@/components/LockedFeature';
import { Placeholder } from '@/components/Placeholder';
import { useAuth } from '@/features/auth/auth-provider';

export default function FeedTab() {
  const { guest } = useAuth();
  if (guest) return <LockedFeature title="Feed" pitch="See your friends' drives, give kudos and share your own." />;
  return <Placeholder title="Feed" note="Friends' drives show up here in Phase 4." />;
}
