// Bottom sheet on the pre-drive screen: choose which car (or motorbike) you are using, or add one.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CarForm } from '@/components/CarForm';
import { carSubtitle, type Car, type VehicleKind } from '@/lib/vehicles';
import { carColours, radius, space, type CarColour } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props {
  visible: boolean;
  /** Which kind of vehicle this sheet is for (follows the travel mode). */
  kind: VehicleKind;
  /** Only the vehicles of that kind. */
  cars: Car[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** A car was just saved: refresh the list and select it. */
  onAdded: (car: Car) => void;
  onClose: () => void;
}

export const colourOf = (key: string) => carColours[key as CarColour] ?? carColours.sport_yellow;

export function CarPickerSheet({ visible, kind, cars, selectedId, onSelect, onAdded, onClose }: Props) {
  const { c, type } = useTheme();
  const noun = kind === 'motorbike' ? 'motorbike' : 'car';
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);

  const close = () => {
    setAdding(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <Pressable accessibilityLabel="Close" onPress={close} style={[styles.scrim, { backgroundColor: c.scrim }]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottom} pointerEvents="box-none">
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + space.lg }]}>
          <View style={[styles.handle, { backgroundColor: c.line }]} />
          <Text accessibilityRole="header" style={[type.sheetTitle, { color: c.text }]}>
            {adding ? `Add a ${noun}` : `Choose your ${noun}`}
          </Text>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {adding ? (
              <CarForm
                kind={kind}
                saveLabel={`Save ${noun}`}
                skipLabel="Back"
                onSkip={() => setAdding(false)}
                onSaved={(car) => {
                  setAdding(false);
                  onAdded(car);
                }}
              />
            ) : (
              <>
                {cars.map((car) => {
                  const selected = car.id === selectedId;
                  const col = colourOf(car.colour);
                  return (
                    <Pressable
                      key={car.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${car.nickname}, ${col.label}`}
                      onPress={() => {
                        onSelect(car.id);
                        close();
                      }}
                      style={[styles.row, { backgroundColor: c.surface2, borderColor: selected ? c.primary : c.line }]}>
                      <View style={[styles.dot, { backgroundColor: col.hex, borderColor: c.line }]} />
                      <View style={styles.grow}>
                        <Text style={[type.rowTitle, { color: c.text }]}>{car.nickname}</Text>
                        <Text style={[type.caption, { color: c.muted }]}>{carSubtitle(car, col.label)}</Text>
                      </View>
                      {selected ? <Text style={{ color: c.primary, fontSize: 20 }}>✓</Text> : null}
                    </Pressable>
                  );
                })}
                <Button label={`Add a ${noun}`} variant="secondary" onPress={() => setAdding(true)} />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    gap: space.md,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  scroll: { flexGrow: 0 },
  content: { gap: space.sm, paddingBottom: space.sm },
  row: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  grow: { flex: 1, gap: 2 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1 },
});
