import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { fmtDate, fmtSize, fmtTime } from '../format';
import { useTheme } from '../theme';
import type { Decision, PhotoItem } from '../types';

export type DeckHandle = {
  /** 供底部大按钮调用，和手指滑动走完全相同的动画路径 */
  fling: (d: Decision) => void;
};

type Props = {
  items: PhotoItem[];
  index: number;
  width: number;
  height: number;
  uris: Record<string, string>;
  sizes: Record<string, number>;
  onDecide: (d: Decision) => void;
  /** 拖过阈值时的轻震，制造"物理反馈" */
  onThreshold?: () => void;
};

const TRIGGER_RATIO = 0.3;

export const SwipeDeck = forwardRef<DeckHandle, Props>(function SwipeDeck(
  { items, index, width, height, uris, sizes, onDecide, onThreshold },
  ref,
) {
  const { c, isDark } = useTheme();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const busy = useRef(false);
  const crossed = useRef(false);

  const radius = 26;

  const fling = useCallback(
    (d: Decision) => {
      if (busy.current) return;
      busy.current = true;
      Animated.timing(pan, {
        toValue: { x: (d === 'keep' ? -1 : 1) * width * 1.4, y: -40 },
        duration: 240,
        useNativeDriver: false,
      }).start(() => {
        onDecide(d);
        pan.setValue({ x: 0, y: 0 });
        busy.current = false;
      });
    },
    [pan, width, onDecide],
  );

  useImperativeHandle(ref, () => ({ fling }), [fling]);

  const reset = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      tension: 90,
      useNativeDriver: false,
    }).start();
    crossed.current = false;
  }, [pan]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.15,
        onPanResponderMove: (_, g) => {
          if (busy.current) return;
          pan.setValue({ x: g.dx, y: g.dy * 0.24 });
          const passed = Math.abs(g.dx) > width * TRIGGER_RATIO;
          if (passed !== crossed.current) {
            crossed.current = passed;
            if (passed) onThreshold?.();
          }
        },
        onPanResponderRelease: (_, g) => {
          if (busy.current) return;
          const far = Math.abs(g.dx) > width * TRIGGER_RATIO;
          const fast = Math.abs(g.vx) > 1.05;
          if (far || fast) {
            fling(g.dx > 0 ? 'trash' : 'keep');
          } else {
            reset();
          }
        },
        onPanResponderTerminate: reset,
        onPanResponderTerminationRequest: () => false,
      }),
    [pan, width, fling, reset, onThreshold],
  );

  if (!items.length) {
    return <View style={{ width, height }} />;
  }

  const rotate = pan.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-13deg', '0deg', '13deg'],
    extrapolate: 'clamp',
  });
  const scale = pan.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [0.97, 1, 0.97],
    extrapolate: 'clamp',
  });
  const keepStamp = pan.x.interpolate({
    inputRange: [-width * TRIGGER_RATIO, -width * 0.08, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });
  const trashStamp = pan.x.interpolate({
    inputRange: [0, width * 0.08, width * TRIGGER_RATIO],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const visible = items.slice(index, index + 3);

  const renderCard = (item: PhotoItem, depth: number) => {
    const size = sizes[item.id] ?? 0;
    const uri = uris[item.id];
    const isTop = depth === 0;
    const body = (
      <>
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={140}
            cachePolicy="memory-disk"
            recyclingKey={item.id}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.skeleton, { backgroundColor: c.panel2 }]}>
            <Text style={{ color: c.textMute, fontSize: 12 }}>正在读取…</Text>
          </View>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.26, 0.56, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.badgeRow} pointerEvents="none">
          {item.group && item.group.total > 1 && (
            <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.46)' }]}>
              <View style={[styles.dot, { backgroundColor: c.warn }]} />
              <Text style={styles.badgeText}>
                连拍 {item.group.idx}/{item.group.total}
              </Text>
            </View>
          )}
          {item.kind === 'screenshot' && (
            <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.46)' }]}>
              <Text style={styles.badgeText}>截图</Text>
            </View>
          )}
        </View>

        <View style={styles.meta} pointerEvents="none">
          <Text style={styles.metaMain}>
            {fmtDate(item.date)} · {fmtTime(item.date)}
          </Text>
          <Text style={styles.metaSub}>
            {size ? fmtSize(size) : '—'}
            {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
          </Text>
        </View>

        {isTop && (
          <>
            <Animated.View
              style={[styles.stamp, styles.stampKeep, { opacity: keepStamp, borderColor: c.keep }]}
              pointerEvents="none"
            >
              <Text style={[styles.stampText, { color: c.keep }]}>保留</Text>
            </Animated.View>
            <Animated.View
              style={[styles.stamp, styles.stampTrash, { opacity: trashStamp, borderColor: c.trash }]}
              pointerEvents="none"
            >
              <Text style={[styles.stampText, { color: c.trash }]}>删除</Text>
            </Animated.View>
          </>
        )}
      </>
    );

    if (isTop) {
      return (
        <Animated.View
          key={item.id}
          {...responder.panHandlers}
          style={[
            styles.card,
            {
              width,
              height,
              borderRadius: radius,
              transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }, { scale }],
            },
          ]}
        >
          {body}
        </Animated.View>
      );
    }

    return (
      <View
        key={item.id}
        style={[
          styles.card,
          {
            width,
            height,
            borderRadius: radius,
            opacity: 1 - depth * 0.24,
            transform: [{ translateY: depth * 20 }, { scale: 1 - depth * 0.035 }],
          },
        ]}
        pointerEvents="none"
      >
        {body}
      </View>
    );
  };

  return (
    <View style={{ width, height: height + 48 }}>
      <View style={[styles.shadow, { backgroundColor: isDark ? '#000' : '#0B1F19' }]} pointerEvents="none" />
      {[...visible].reverse().map((item, i) => renderCard(item, visible.length - 1 - i))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    backgroundColor: '#101715',
  },
  shadow: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: -10,
    height: 22,
    borderRadius: 12,
    opacity: 0.2,
  },
  skeleton: { alignItems: 'center', justifyContent: 'center' },
  badgeRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  meta: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 20,
  },
  metaMain: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metaSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12.5,
    marginTop: 4,
    fontWeight: '500',
  },
  stamp: {
    position: 'absolute',
    top: 26,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 2.5,
    transform: [{ rotate: '-8deg' }],
  },
  stampKeep: { left: 20 },
  stampTrash: { right: 20, transform: [{ rotate: '8deg' }] },
  stampText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
  },
});
