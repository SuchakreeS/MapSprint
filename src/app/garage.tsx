// Screen 23 Garage (design/screens/*/23-garage.png, design/source/ScrGarage.dc.html).
// Cars and motorbikes. "Default" = the vehicle the pre-drive screen starts with for that kind (one default car, one default
// motorbike, remembered per account on this phone).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colourOf } from '@/components/CarPickerSheet';
import { Header } from '@/components/Header';
import { CarTopIcon, PencilIcon, PlusIcon } from '@/components/icons';
import { useVehicles } from '@/features/auth/vehicles';
import { loadDrives } from '@/features/recording/drive-history';
import { formatDistanceKm } from '@/lib/format';
import { carStats, carSubtitle, type Car } from '@/lib/vehicles';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type DriveRef = { vehicleId: string | null; distanceM: number };

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { c, type, fonts } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[type.label, { color: c.muted }]}>{label}</Text>
      <Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 22 }}>
        {value}
        {unit ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function CarCard({ car, isDefault, drives }: { car: Car; isDefault: boolean; drives: DriveRef[] }) {
  const { c, type, fonts } = useTheme();
  const col = colourOf(car.colour);
  const stats = carStats(drives, car.id);
  const edit = () => router.push({ pathname: '/garage-car', params: { id: car.id } });
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.top}>
        <View style={[styles.iconTile, { backgroundColor: c.surface2 }]}>
          <CarTopIcon body={col.hex} outline={c.line} glass={c.bg} height={48} />
        </View>
        <View style={styles.grow}>
          <View style={styles.nameRow}>
            <Text style={[type.heading, { color: c.text, flexShrink: 1 }]} numberOfLines={1}>
              {car.nickname}
            </Text>
            {isDefault ? (
              <View style={[styles.badge, { backgroundColor: c.accentFill }]}>
                <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 12 }}>Default</Text>
              </View>
            ) : null}
          </View>
          <Text style={[type.small, { color: c.muted }]}>{carSubtitle(car, col.label)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${car.nickname}, ${car.kind}`} onPress={edit} style={styles.editBtn}>
          <PencilIcon color={c.muted} />
        </Pressable>
      </View>
      <View style={[styles.stats, { borderTopColor: c.line }]}>
        <Stat label="DISTANCE" value={formatDistanceKm(stats.distanceM, 0)} unit="km" />
        <Stat label="DRIVES" value={String(stats.drives)} />
        {/* Smooth score comes with Phase 3 (3.5). */}
        <Stat label="AVG SMOOTH" value="–" />
      </View>
    </View>
  );
}

export default function GarageScreen() {
  const { c, type, fonts } = useTheme();
  const { cars, selectedByKind, refresh } = useVehicles();
  // Totals come from drives on this phone (the server has none until 2.3 upload).
  const [drives, setDrives] = useState<DriveRef[]>([]);

  // Back from editing / adding a car, or after a drive: re-read both.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      setDrives(loadDrives().map((d) => ({ vehicleId: d.vehicleId, distanceM: d.summary.distanceM })));
    }, [refresh]),
  );

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Header title="Garage" onBack={() => router.back()} />
        {cars.length === 0 ? (
          <Text style={[type.body, { color: c.muted }]}>
            Nothing here yet. Add your car or motorbike: its colour becomes your icon on the map.
          </Text>
        ) : null}
        {cars.map((car) => (
          <CarCard key={car.id} car={car} isDefault={car.id === selectedByKind[car.kind]?.id} drives={drives} />
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/garage-car')}
          style={({ pressed }) => [styles.add, { borderColor: c.muted, opacity: pressed ? 0.7 : 1 }]}>
          <PlusIcon color={c.text} />
          <Text style={{ color: c.text, fontFamily: fonts.bodyBold, fontSize: 16 }}>Add a car or motorbike</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.lg, gap: space.md },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  iconTile: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { height: 24, paddingHorizontal: space.sm, borderRadius: 12, justifyContent: 'center' },
  editBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 14 },
  stat: { flex: 1, gap: 2 },
  add: {
    height: 60,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
