import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from '../components/ui';
import { fmtSize } from '../format';
import { MODES } from '../types';
import type { Session } from '../useSession';

export function DoneScreen({ s }: { s: Session }) {
  const { c } = useTheme();
  const { cleaned, freed, kept } = s.result;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.badge}>
          <View style={[styles.ring, { borderColor: c.keepSoft }]}>
            <View style={[styles.ringInner, { backgroundColor: c.keepSoft }]}>
              <Text style={{ fontSize: 30, color: c.keep }}>✓</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.title, { color: c.text }]}>
          {cleaned ? `清掉 ${cleaned} 张` : '这一批什么都没删'}
        </Text>
        <Text style={[styles.sub, { color: c.textMute }]}>
          {cleaned
            ? `相册更清爽了一点${freed ? `，释放约 ${fmtSize(freed)}` : ''}`
            : '保守一点也没关系，慢慢来'}
        </Text>

        <View style={styles.stats}>
          <Stat label="已删除" value={String(cleaned)} color={c.trash} />
          <View style={[styles.divider, { backgroundColor: c.line }]} />
          <Stat label="释放空间" value={freed ? fmtSize(freed) : '—'} color={c.keep} />
          <View style={[styles.divider, { backgroundColor: c.line }]} />
          <Stat label="保留" value={String(kept)} color={c.textDim} />
        </View>

        {s.remain > 0 && (
          <View style={[styles.warn, { backgroundColor: c.panel, borderColor: c.line }]}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
              还有 {s.remain} 张没有删成
            </Text>
            <Text style={{ color: c.textMute, fontSize: 11.5, marginTop: 3, lineHeight: 18 }}>
              通常是系统弹窗只确认了一部分，或文件被别的 App 占用。它们仍留在待删除列表里。
            </Text>
            <Pressable onPress={s.openReview} hitSlop={6} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={{ color: c.accent, fontSize: 12.5, fontWeight: '700' }}>回去继续处理 ›</Text>
            </Pressable>
          </View>
        )}

        <Text style={[styles.foot, { color: c.textMute }]}>
          被删掉的照片在系统相册的「回收站 / 最近删除」里通常还能存 30 天。
          清掉相册里剩下的 {s.library.length} 张，可以再来一轮。
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: c.line }]}>
        <Button label="回到首页" tone="subtle" onPress={s.goHome} style={{ flex: 1 }} />
        <View style={{ width: 10 }} />
        <Button
          label={`再来一批 · ${MODES[s.mode].name}`}
          onPress={() => s.start(s.mode)}
          disabled={!s.library.length}
          style={{ flex: 1.5 }}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: c.textMute, fontSize: 10.5, marginTop: 3, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 34, paddingBottom: 20, alignItems: 'center' },
  badge: { marginBottom: 18 },
  ring: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  sub: { fontSize: 12.5, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 28,
    marginBottom: 18,
  },
  divider: { width: StyleSheet.hairlineWidth, height: 26 },
  warn: {
    alignSelf: 'stretch',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  foot: { fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 20 },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
