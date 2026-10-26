import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { ActionButton, ProgressBar } from '../components/ui';
import { SwipeDeck } from '../components/SwipeDeck';
import type { DeckHandle } from '../components/SwipeDeck';
import { usePhotoDetails } from '../photos';
import { MODES } from '../types';
import type { Session } from '../useSession';

export function SwipeScreen({ s }: { s: Session }) {
  const { c } = useTheme();
  const win = useWindowDimensions();
  const deckRef = useRef<DeckHandle>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const visible = s.queue.slice(s.index, s.index + 3);
  const { uris, sizes } = usePhotoDetails(visible);

  const shown = Math.min(s.index + 1, s.queue.length);
  const progress = s.queue.length ? s.index / s.queue.length : 0;

  const cardW = Math.min((area.w || win.width - 44) , 460);
  const cardH = Math.max(220, Math.min(area.h || 420, cardW * 1.34));

  const buzz = () => {
    try {
      Haptics.selectionAsync();
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={styles.root}>
      {/* 顶栏 */}
      <View style={styles.topBar}>
        <Pressable
          onPress={s.goHome}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.iconGlyph, { color: c.textDim }]}>‹</Text>
        </Pressable>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[styles.counter, { color: c.text }]}>
            {shown}
            <Text style={{ color: c.textMute }}> / {s.queue.length}</Text>
          </Text>
          <Text style={[styles.modeTag, { color: c.textMute }]}>
            {MODES[s.mode].name}模式{s.mode === 'inf' ? ' · 不限张数' : ''}
          </Text>
        </View>

        <Pressable
          onPress={s.undo}
          disabled={!s.index}
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconBtn,
            { opacity: s.index ? (pressed ? 0.6 : 1) : 0.28 },
          ]}
        >
          <Text style={[styles.iconGlyph, { color: c.textDim, fontSize: 19 }]}>↺</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 22 }}>
        <ProgressBar value={progress} />
      </View>

      {/* 卡片区 */}
      <View
        style={styles.deckArea}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setArea({ w: width, h: height });
        }}
      >
        {visible.length ? (
          <SwipeDeck
            ref={deckRef}
            items={s.queue}
            index={s.index}
            width={cardW}
            height={cardH}
            uris={uris}
            sizes={sizes}
            onDecide={s.decide}
            onThreshold={buzz}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.textMute, fontSize: 13 }}>这一批已经滑完了</Text>
          </View>
        )}
      </View>

      {/* 底部操作 */}
      <View style={styles.bottom}>
        <View style={styles.hintRow}>
          <Text style={[styles.hint, { color: c.textMute }]}>← 左滑保留</Text>
          <Pressable onPress={s.openReview} hitSlop={8}>
            <Text style={[styles.finishLink, { color: c.textDim }]}>结束本批 · 去终审 ›</Text>
          </Pressable>
          <Text style={[styles.hint, { color: c.textMute }]}>右滑删除 →</Text>
        </View>

        <View style={styles.actionRow}>
          <ActionButton
            label="保留"
            hint="左滑"
            tone="keep"
            disabled={!visible.length}
            onPress={() => deckRef.current?.fling('keep')}
            icon={<Text style={{ color: c.keep, fontSize: 15, fontWeight: '800' }}>✓</Text>}
          />
          <Pressable
            onPress={s.undo}
            disabled={!s.index}
            style={({ pressed }) => [
              styles.undoBtn,
              {
                backgroundColor: c.panel,
                borderColor: c.line,
                opacity: s.index ? (pressed ? 0.7 : 1) : 0.35,
                transform: [{ scale: pressed && s.index ? 0.94 : 1 }],
              },
            ]}
          >
            <Text style={{ fontSize: 17, color: c.textDim }}>↺</Text>
            <Text style={{ fontSize: 9.5, color: c.textMute, marginTop: 1 }}>撤销</Text>
          </Pressable>
          <ActionButton
            label="删除"
            hint="右滑"
            tone="trash"
            disabled={!visible.length}
            onPress={() => deckRef.current?.fling('trash')}
            icon={<Text style={{ color: c.trash, fontSize: 14, fontWeight: '800' }}>✕</Text>}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 28, fontWeight: '300', marginTop: -4 },
  counter: { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  modeTag: { fontSize: 10.5, marginTop: 2, letterSpacing: 0.4 },
  deckArea: {
    flex: 1,
    marginTop: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { paddingHorizontal: 18, paddingBottom: 10 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  hint: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  finishLink: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  undoBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
