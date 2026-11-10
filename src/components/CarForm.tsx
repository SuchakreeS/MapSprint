// Add / edit vehicle form (design 05). Used by onboarding step 5, the picker sheet (pre-drive) and the Garage.
// Cars and motorbikes share it. The kind is chosen when adding (fixed by the caller, or a toggle) and never changes after.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CarTopIcon } from '@/components/icons';
import { Segmented } from '@/components/SettingsRow';
import { TextField } from '@/components/TextField';
import { CAR_COLUMNS } from '@/features/auth/vehicles';
import { supabase } from '@/features/sync/supabase';
import { normaliseKind, type Car, type VehicleKind } from '@/lib/vehicles';
import { carColours, radius, space, type CarColour } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const COLOUR_KEYS = Object.keys(carColours) as CarColour[];

interface Props {
  /** Edit this vehicle instead of adding a new one. */
  initial?: Car;
  /** Adding: fix the kind (the caller already knows it). Omitted = show a Car / Motorbike toggle. */
  kind?: VehicleKind;
  saveLabel: string;
  skipLabel: string;
  /** Car saved to Supabase. */
  onSaved: (car: Car) => void;
  onSkip: () => void;
}

const isColour = (k: string): k is CarColour => k in carColours;
const KIND_OPTIONS = [
  { value: 'car' as const, label: 'Car' },
  { value: 'motorbike' as const, label: 'Motorbike' },
];

export function CarForm({ initial, kind: fixedKind, saveLabel, skipLabel, onSaved, onSkip }: Props) {
  const { c, type } = useTheme();
  const [pickedKind, setPickedKind] = useState<VehicleKind>('car');
  const kind: VehicleKind = initial?.kind ?? fixedKind ?? pickedKind;
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
    // RLS: update only works on your own vehicle (policy "vehicles: update own"). `kind` is insert-only (no update grant).
    const { data, error: err } = await (initial
      ? table.update(fields).eq('id', initial.id).select(CAR_COLUMNS).single()
      : table.insert({ ...fields, kind }).select(CAR_COLUMNS).single());
    setBusy(false);
    if (err || !data) {
      setError('Could not save your car. Check your connection and try again.');
      return;
    }
    onSaved({ ...data, kind: normaliseKind(data.kind) });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.preview, { backgroundColor: c.surface, borderColor: c.line }]}>
        <CarTopIcon body={carColours[colour].hex} outline={c.line} glass={c.bg} />
      </View>

      {!initial && !fixedKind ? (
        <Segmented label="Type" options={KIND_OPTIONS} value={pickedKind} onChange={setPickedKind} />
      ) : null}

      <TextField
        label="Nickname"
        value={nickname}
        onChangeText={setNickname}
        placeholder={kind === 'motorbike' ? 'Daily rider' : 'Daily driver'}
        maxLength={30}
      />
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
