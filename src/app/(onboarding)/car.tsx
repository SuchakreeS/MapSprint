// Screen 05 Add your car (design 05, ScrAddCar.dc.html). Step 5 of 5. Skippable.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CarTopIcon } from '@/components/icons';
import { StepHeader } from '@/components/StepHeader';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/auth-provider';
import { supabase } from '@/features/sync/supabase';
import { carColours, radius, space, type CarColour } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const COLOUR_KEYS = Object.keys(carColours) as CarColour[];

export default function CarScreen() {
  const { c, type } = useTheme();
  const { userId, markCarDone } = useAuth();
  const [nickname, setNickname] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [colour, setColour] = useState<CarColour>('sport_yellow');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('vehicles').insert({
      nickname: nickname.trim(),
      make: make.trim() || null,
      model: model.trim() || null,
      colour,
    });
    setBusy(false);
    if (err) {
      setError('Could not save your car. Check your connection, or skip for now.');
      return;
    }
    markCarDone(); // onboarding guard opens the app
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <StepHeader step={5} total={5} />
        <View style={styles.block}>
          <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
            Add your car
          </Text>
          <Text style={[type.body, { color: c.muted }]}>
            Its colour becomes your car icon on the map. You can add more cars later.
          </Text>
        </View>

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
          <Button label={busy ? 'Saving…' : 'Continue'} onPress={onContinue} disabled={!nickname.trim() || busy} />
          <Button label="Skip for now" variant="ghost" onPress={markCarDone} disabled={busy} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.xl, gap: space.xl, flexGrow: 1 },
  block: { gap: space.sm },
  preview: { height: 136, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatchRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  actions: { gap: space.sm, marginTop: 'auto' },
});
