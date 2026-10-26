import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

/* ---------------- 按下有反馈的通用按钮 ---------------- */

type ButtonTone = 'primary' | 'keep' | 'trash' | 'ghost' | 'subtle';

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  loading,
  icon,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  small?: boolean;
  style?: object;
}) {
  const { c } = useTheme();

  const bg: Record<ButtonTone, string> = {
    primary: c.accent,
    keep: c.keep,
    trash: c.trash,
    ghost: 'transparent',
    subtle: c.panel2,
  };
  const fg: Record<ButtonTone, string> = {
    primary: '#04140E',
    keep: '#04140E',
    trash: '#FFF5F5',
    ghost: c.textDim,
    subtle: c.text,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: 'rgba(255,255,255,0.14)' }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        {
          backgroundColor: bg[tone],
          borderWidth: tone === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: c.line,
          opacity: disabled ? 0.38 : pressed ? 0.86 : 1,
          transform: [{ scale: pressed && !disabled ? 0.975 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[tone]} size="small" />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Text style={[styles.btnText, small && styles.btnTextSmall, { color: fg[tone] }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/* ---------------- 主按钮的圆形/胶囊变体（滑卡页底部） ---------------- */

export function ActionButton({
  label,
  hint,
  tone,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  hint: string;
  tone: 'keep' | 'trash';
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const { c } = useTheme();
  const color = tone === 'keep' ? c.keep : c.trash;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        {
          borderColor: color,
          backgroundColor: tone === 'keep' ? c.keepSoft : c.trashSoft,
          opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !disabled ? 0.955 : 1 }],
        },
      ]}
    >
      {icon}
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Text style={[styles.actionHint, { color: c.textMute }]}>{hint}</Text>
    </Pressable>
  );
}

/* ---------------- 细进度条 ---------------- */

export function ProgressBar({ value }: { value: number }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { backgroundColor: c.panel2 }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.accent }]} />
    </View>
  );
}

/* ---------------- 底部确认弹层 ---------------- */

export function ConfirmSheet({
  visible,
  title,
  desc,
  confirmText,
  cancelText = '取消',
  danger,
  busy,
  onConfirm,
  onCancel,
  extra,
}: {
  visible: boolean;
  title: string;
  desc: string;
  confirmText: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  extra?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} />
        <View style={[styles.sheet, { backgroundColor: c.bgElev, borderColor: c.line }]}>
          <View style={[styles.grabber, { backgroundColor: c.panel2 }]} />
          <Text style={[styles.sheetTitle, { color: c.text }]}>{title}</Text>
          <Text style={[styles.sheetDesc, { color: c.textDim }]}>{desc}</Text>
          {extra}
          <View style={styles.sheetActions}>
            <Button label={cancelText} tone="subtle" onPress={onCancel} disabled={busy} style={{ flex: 1 }} />
            <View style={{ width: 10 }} />
            <Button
              label={confirmText}
              tone={danger ? 'trash' : 'primary'}
              onPress={onConfirm}
              loading={busy}
              style={{ flex: 1.3 }}
            />
          </View>
          <Text style={[styles.sheetFoot, { color: c.textMute }]}>
            确认后系统还会再弹一次确认框，这是安卓的强制保护
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------- 轻提示 ---------------- */

export function Toast({ text }: { text: string | null }) {
  const { c } = useTheme();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={[styles.toast, { backgroundColor: c.panel, borderColor: c.line }]}>
        <Text style={[styles.toastText, { color: c.text }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  btnSmall: { height: 42, borderRadius: 13, paddingHorizontal: 14 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  btnTextSmall: { fontSize: 13.5, fontWeight: '600' },

  action: {
    flex: 1,
    height: 68,
    borderRadius: 20,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  actionLabel: { fontSize: 16.5, fontWeight: '800', letterSpacing: 1 },
  actionHint: { fontSize: 10.5, fontWeight: '500' },

  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 10,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 19, fontWeight: '800', letterSpacing: 0.2 },
  sheetDesc: { fontSize: 13.5, lineHeight: 21 },
  sheetActions: { flexDirection: 'row', marginTop: 12 },
  sheetFoot: { fontSize: 11, textAlign: 'center', marginTop: 2 },

  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 108, alignItems: 'center' },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toastText: { fontSize: 13, fontWeight: '600' },
});
