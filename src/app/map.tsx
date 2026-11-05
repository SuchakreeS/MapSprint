import { Camera, LocationPuck, MapView } from '@rnmapbox/maps';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ensureForegroundPermission } from '@/features/recording/recorder';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const STYLE = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
};

export default function MapSpike() {
  const { mode, c } = useTheme();
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    ensureForegroundPermission().then(setGranted);
  }, []);

  return (
    <View style={styles.fill}>
      <MapView style={styles.fill} styleURL={STYLE[mode]} scaleBarEnabled={false} compassEnabled>
        <Camera followUserLocation followZoomLevel={15} />
        {granted && <LocationPuck puckBearingEnabled puckBearing="course" pulsing={{ isEnabled: true }} />}
      </MapView>
      <View style={[styles.badge, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={{ color: c.text, fontWeight: '700' }}>
          {granted === null ? 'Asking for location…' : granted ? 'PASS if map + puck show' : 'Location denied'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  badge: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xxl,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
