import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from '../components/ui';
import { MODES } from '../types';
import type { Session } from '../useSession';
import type { SessionMode } from '../types';

const MODE_LIST: SessionMode[] = ['easy', 'pro', 'inf'];

export function HomeScreen({ s }: { s: Session }) {
  const { c, isDark, toggle } = useTheme();
  const [mode, setMode] = React.useState<SessionMode>('easy');

  const accessLabel =
    s.access === 'granted'
      ? '已授权 · 可读取全部照片'
      : s.access === 'limited'
        ? '仅授权了部分照片'
        : s.access === 'denied'
          ? '未授权'
          : '等待授权';

  const accessTone = s.access === 'granted' ? c.keep : s.access === 'limited' ? c.warn : c.trash;
  const available = s.library.length;
  const limit = MODES[mode].count;
  const willUse = Number.isFinite(limit) ? Math.min(limit, available) : available;
  const canStart = available > 0 && (s.access === 'granted' || s.access === 'limited');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>PhotoSweep</Text>
            <Text style={[styles.subtitle, { color: c.textMute }]}>相册清理 · 全部在本机完成</Text>
          </View>
          <Pressable
            onPress={toggle}
            hitSlop={10}
            style={({ pressed }) => [
              styles.themeBtn,
              { backgroundColor: c.panel, borderColor: c.line, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ fontSize: 17 }}>{isDark ? '☀️' : '🌙'}</Text>
          </Pressable>
        </View>

        {/* 相册状态 */}
        <View style={[styles.albumCard, { backgroundColor: c.panel, borderColor: c.line }]}>
          <View style={styles.albumTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.albumNum, { color: c.text }]}>
                {s.loading ? '读取中…' : `${s.albumTotal || 0}`}
                {!s.loading && <Text style={[styles.albumUnit, { color: c.textDim }]}> 张照片</Text>}
              </Text>
              <Text style={[styles.albumHint, { color: c.textMute }]}>
                {s.access === 'granted' || s.access === 'limited'
                  ? `本次已载入 ${available} 张用于清理`
                  : '授予权限后才能读出真实相册'}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: c.panel2 }]}>
              <View style={[styles.pillDot, { backgroundColor: accessTone }]} />
              <Text style={[styles.pillText, { color: c.textDim }]}>{accessLabel}</Text>
            </View>
          </View>

          {(!canStart || s.access === 'limited') && (
            <View style={{ marginTop: 14, gap: 8 }}>
              <Button
                label={s.access === 'limited' ? '继续授权更多照片' : '授予相册权限'}
                onPress={s.access === 'limited' ? s.grantMore : s.grant}
                loading={s.loading}
                tone="primary"
              />
              {s.notice && <Text style={[styles.notice, { color: c.warn }]}>{s.notice}</Text>}
            </View>
          )}
        </View>

        {/* 批次模式 */}
        <Text style={[styles.section, { color: c.textMute }]}>这次想清理多少？</Text>
        <View style={{ gap: 10 }}>
          {MODE_LIST.map((key) => {
            const m = MODES[key];
            const active = mode === key;
            const countText = Number.isFinite(m.count) ? `${m.count} 张` : '不限张数';
            return (
              <Pressable
                key={key}
                onPress={() => setMode(key)}
                style={({ pressed }) => [
                  styles.modeCard,
                  {
                    backgroundColor: active ? (isDark ? c.panel2 : '#FFFFFF') : c.panel,
                    borderColor: active ? c.accent : c.line,
                    borderWidth: active ? 1.6 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.86 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.modeIcon,
                    { backgroundColor: active ? c.keepSoft : c.panel2 },
                  ]}
                >
                  <Text style={{ fontSize: 18, color: active ? c.accent : c.textDim }}>{m.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeName, { color: c.text }]}>{m.name}</Text>
                  <Text style={[styles.modeSub, { color: c.textMute }]}>{m.sub}</Text>
                </View>
                <Text style={[styles.modeCount, { color: active ? c.accent : c.textMute }]}>{countText}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.footNote, { color: c.textMute }]}>
          左滑保留、右滑标记删除；本批结束会先进入「终审复判」，
          确认无误后才调用系统删除，误点随时能移回。
        </Text>

        {/* 三步流程，让第一次用的人知道会发生什么 */}
        <View style={[styles.steps, { backgroundColor: c.panel, borderColor: c.line }]}>
          {[
            { n: '1', t: '滑卡', d: '左留 · 右删' },
            { n: '2', t: '复判', d: '九宫格检查' },
            { n: '3', t: '清理', d: '系统再确认' },
          ].map((step, i) => (
            <React.Fragment key={step.n}>
              {i > 0 && <View style={[styles.stepDivider, { backgroundColor: c.line }]} />}
              <View style={styles.step}>
                <View style={[styles.stepNum, { backgroundColor: c.panel2 }]}>
                  <Text style={{ color: c.accent, fontSize: 11, fontWeight: '800' }}>{step.n}</Text>
                </View>
                <Text style={[styles.stepTitle, { color: c.text }]}>{step.t}</Text>
                <Text style={[styles.stepDesc, { color: c.textMute }]}>{step.d}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: c.line }]}>
        <Button
          label={canStart ? `开始清理 · ${willUse} 张` : '等待相册授权'}
          onPress={() => s.start(mode)}
          disabled={!canStart}
          loading={s.loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 26 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 18 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 12.5, marginTop: 3, letterSpacing: 0.3 },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  albumCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  albumTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  albumNum: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  albumUnit: { fontSize: 14, fontWeight: '600' },
  albumHint: { fontSize: 12, marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 150,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10.5, fontWeight: '600', flexShrink: 1 },
  notice: { fontSize: 12, lineHeight: 18 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 24, marginBottom: 10 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
  },
  modeIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modeName: { fontSize: 15.5, fontWeight: '700' },
  modeSub: { fontSize: 11.5, marginTop: 2 },
  modeCount: { fontSize: 13, fontWeight: '700' },
  footNote: { fontSize: 11.5, lineHeight: 19, marginTop: 22 },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    marginTop: 18,
  },
  step: { flex: 1, alignItems: 'center', gap: 2 },
  stepDivider: { width: StyleSheet.hairlineWidth, height: 30 },
  stepNum: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  stepTitle: { fontSize: 12, fontWeight: '700' },
  stepDesc: { fontSize: 10, letterSpacing: 0.2 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
