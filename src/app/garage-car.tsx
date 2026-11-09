// Add or edit one car from the Garage (form = design 05). `?id=` edits that car; no id adds a new one.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CarForm } from '@/components/CarForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Header } from '@/components/Header';
import { useVehicles } from '@/features/auth/vehicles';
import { supabase } from '@/features/sync/supabase';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function GarageCarScreen() {
  const { c, type } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { cars, selected, select, refresh } = useVehicles();
  const car = id ? cars.find((v) => v.id === id) : undefined;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = async () => {
    await refresh();
    router.back();
  };

  const onDelete = async () => {
    if (!car) return;
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    // RLS: delete only works on your own car. Drives on the server keep existing (vehicle_id -> null).
    const { error: err } = await supabase.from('vehicles').delete().eq('id', car.id);
    setBusy(false);
    if (err) {
      setError('Could not delete the car. Check your connection and try again.');
      return;
    }
    await done();
  };

  if (id && !car) {
    // Opened with an id we do not have (deleted on another phone, or the list has not loaded).
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <Header title="Edit car" onBack={() => router.back()} />
          <Text style={[type.body, { color: c.muted }]}>This car is not in your garage any more.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Header title={car ? 'Edit car' : 'Add a car'} onBack={() => router.back()} />

        {/* key: re-mount the form if the car arrives after the first render (cache -> fresh list). */}
        <CarForm
          key={car?.id ?? 'new'}
          initial={car}
          saveLabel={car ? 'Save changes' : 'Add car'}
          skipLabel="Cancel"
          onSkip={() => router.back()}
          onSaved={() => void done()} // a new car does not become the default here; the first car always is
        />

        {car ? (
          <>
            {car.id !== selected?.id ? (
              <Button
                label="Use as default car"
                variant="secondary"
                onPress={() => {
                  select(car.id);
                  router.back();
                }}
                disabled={busy}
              />
            ) : null}
            <Button
              label={busy ? 'Deleting…' : 'Delete car'}
              variant="danger"
              onPress={() => setConfirmDelete(true)}
              disabled={busy}
            />
            {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}
          </>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        tag="DELETE CAR"
        title={`Delete ${car?.nickname ?? 'this car'}?`}
        message="Your drives stay. They just won't show this car any more."
        cancelLabel="Keep car"
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.lg, gap: space.lg, flexGrow: 1 },
});
