import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props {
  visible: boolean;
  /** Small gold tag above the title, e.g. "WARNING". */
  tag?: string;
  title: string;
  message: string;
  /** Safe choice: filled yellow button, also used for tap-outside and Android back. */
  cancelLabel: string;
  /** Risky choice: outlined red button. */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  visible,
  tag,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: Props) {
  const { c, type } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel={cancelLabel}
        onPress={onCancel}
        style={[styles.scrim, { backgroundColor: c.scrim }]}>
        {/* Inner Pressable swallows taps so touching the card does not dismiss. */}
        <Pressable
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          {tag ? <Text style={[type.label, { color: c.gold }]}>{tag}</Text> : null}
          <Text accessibilityRole="header" style={[type.heading, { color: c.text }]}>
            {title}
          </Text>
          <Text style={[type.body, { color: c.muted }]}>{message}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} onPress={onCancel} />
            <Button label={confirmLabel} variant="danger" onPress={onConfirm} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', padding: space.xl },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.md,
  },
  actions: { gap: space.sm, marginTop: space.sm },
});
