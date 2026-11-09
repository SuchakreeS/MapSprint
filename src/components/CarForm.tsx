// Add / edit car form (design 05). Used by onboarding step 5, the car picker sheet (pre-drive) and the Garage.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CarTopIcon } from '@/components/icons';
import { TextField } from '@/components/TextField';
import { CAR_COLUMNS } from '@/features/auth/vehicles';
import { supabase } from '@/features/sync/supabase';
import type { Car } from '@/lib/vehicles';
import { carColours, radius, space, type CarColour } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const COLOUR_KEYS = Object.keys(carColours) as CarColour[];

interface Props {
  /** Edit this car instead of adding a new one. */
  initial?: Car;
  saveLabel: string;
  skipLabel: string;
  /** Car saved to Supabase. */
  onSaved: (car: Car) => void;
  onSkip: () => void;
}

const isColour = (k: string): k is CarColour => k in carColours;

export function CarForm({ initial, saveLabel, skipLabel, onSaved, onSkip }: Props) {
  const { c, type } = useTheme();
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [make, setMake] = useState(initial?.make ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [colour, setColour] = useState<CarColour>(
    initial && isColour(initial.colour) ? initial.colour : 'sport_yellow',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setBusy(true);
    setError(null);
    const fields = { nickname: nickname.trim(), make: make.trim() || null, model: model.trim() || null, colour };
    const table = supabase.from('vehicles');
    // RLS: update only works on your own car (policy "vehicles: update own").
    const { data, error: err } = await (initial
      ? table.update(fields).eq('id', initial.id).select(CAR_COLUMNS).single()
      : table.insert(fields).select(CAR_COLUMNS).single());
    setBusy(false);
    if (err || !data) {
      setError('Could not save your car. Check your connection and try again.');
      return;
    }
    onSaved(data);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.preview, { backgroundColor: c.surface, borderColor: c.line }]}>
        <CarTopIcon body={carColours[colour].hex} outline={c.line} glass={c.bg} />
      </View>

      <TextField label="Nickname" value={nickname} onChangeText={setNickname} placeholder="Daily driver" maxLength={30} />
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField label="Make" value={make} onChangeText={setMake} placeholder="e.g. your brand" maxLength={30} />
        </View>
        <View style={styles.half}>
          <TextField label="Model" value={model} onChangeText={setModel} placeholder="e.g. hatchback" maxLength={30} />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={[type.bodyStrong, { color: c.text }]}>
          Colour <Text style={{ color: c.muted }}>· {carColours[colour].label}</Text>
        </Text>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {COLOUR_KEYS.map((k) => {
            const selected = k === colour;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityLabel={carColours[k].label}
                accessibilityState={{ selected }}
                onPress={() => setColour(k)}
                style={[styles.swatchRing, { borderColor: selected ? c.primary : 'transparent' }]}>
                <View style={[styles.swatch, { backgroundColor: carColours[k].hex, borderColor: c.line }]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
        {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}
        <Button label={busy ? 'Saving…' : saveLabel} onPress={onSave} disabled={!nickname.trim() || busy} />
        <Button label={skipLabel} variant="ghost" onPress={onSkip} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, gap: space.xl },
  block: { gap: space.sm },
  preview: { height: 136, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatchRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  actions: { gap: space.sm, marginTop: 'auto' },
});
