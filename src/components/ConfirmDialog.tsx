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
  /**
   * `cancel` (default): the safe button is the filled yellow one, the confirm is outlined red.
   * `confirm`: for prompts where confirming is the expected answer ("Finish this drive?"): the
   * confirm button is the filled one and goes first.
   */
  emphasis?: 'cancel' | 'confirm';
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
  emphasis = 'cancel',
}: Props) {
  const { c, type } = useTheme();
  const confirmFirst = emphasis === 'confirm';
  const cancelButton = (
    <Button label={cancelLabel} variant={confirmFirst ? 'secondary' : 'primary'} onPress={onCancel} />
  );
  const confirmButton = (
    <Button label={confirmLabel} variant={confirmFirst ? 'primary' : 'danger'} onPress={onConfirm} />
  );
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
            {confirmFirst ? confirmButton : cancelButton}
            {confirmFirst ? cancelButton : confirmButton}
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
