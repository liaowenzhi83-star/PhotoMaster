import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../theme';
import { Button, ConfirmSheet } from '../components/ui';
import { fmtSize } from '../format';
import { usePhotoDetails } from '../photos';
import type { Session } from '../useSession';

const H_PAD = 18;
const GAP = 7;

export function ReviewScreen({ s }: { s: Session }) {
  const { c } = useTheme();
  const [confirm, setConfirm] = useState(false);
  const { width } = useWindowDimensions();
  // 显式算格子边长，避免 flex + aspectRatio 在不同机型上出现右侧留白
  const cellSize = Math.floor((width - H_PAD * 2 - GAP * 2) / 3);

  const items = s.trash.map((t) => t.item);
  const { uris, sizes } = usePhotoDetails(items);

  const selected = s.trash.filter((t) => t.selected);
  const selectedSize = selected.reduce((sum, t) => sum + (sizes[t.item.id] ?? 0), 0);
  const allSelected = s.trash.length > 0 && selected.length === s.trash.length;

  const empty = s.trash.length === 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>终审复判</Text>
        <Text style={[styles.sub, { color: c.textMute }]}>
          这些是刚才标记删除的 {s.trash.length} 张，还没真正删除
        </Text>
      </View>

      {empty ? (
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 34 }}>🌿</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>这里空空如也</Text>
          <Text style={[styles.emptyDesc, { color: c.textMute }]}>
            本批没有标记任何照片，所以什么都不用删。
          </Text>
          <View style={{ height: 18 }} />
          <Button label="返回继续挑" onPress={s.goHome} tone="primary" style={{ minWidth: 180 }} />
        </View>
      ) : (
        <>
          <View style={[styles.summary, { backgroundColor: c.panel, borderColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sumNum, { color: c.text }]}>
                {selected.length}
                <Text style={[styles.sumUnit, { color: c.textMute }]}> / {s.trash.length} 张已勾选</Text>
              </Text>
              <Text style={[styles.sumSub, { color: c.textMute }]}>
                预计释放 {selectedSize ? `约 ${fmtSize(selectedSize)}` : '（计算中…）'}
              </Text>
            </View>
            <Pressable
              onPress={() => s.selectAll(!allSelected)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.selectAll,
                { backgroundColor: c.panel2, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: c.textDim, fontSize: 12, fontWeight: '600' }}>
                {allSelected ? '取消全选' : '全选'}
              </Text>
            </Pressable>
          </View>

          <FlatList
            data={s.trash}
            keyExtractor={(t) => t.item.id}
            numColumns={3}
            style={{ flex: 1 }}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={{ gap: GAP }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: t }) => {
              const on = t.selected;
              return (
                <Pressable
                  onPress={() => s.toggleSelect(t.item.id)}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: c.panel2,
                      opacity: pressed ? 0.85 : 1,
                      borderColor: on ? 'transparent' : c.line,
                    },
                  ]}
                >
                  {uris[t.item.id] ? (
                    <Image
                      source={{ uri: uris[t.item.id] }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={100}
                      recyclingKey={t.item.id}
                      cachePolicy="memory-disk"
                    />
                  ) : null}
                  {!on && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,10,9,0.62)' }]} />}

                  {/* 勾选状态 */}
                  <View
                    style={[
                      styles.check,
                      {
                        backgroundColor: on ? c.accent : 'rgba(0,0,0,0.42)',
                        borderColor: on ? c.accent : 'rgba(255,255,255,0.62)',
                      },
                    ]}
                  >
                    {on && <Text style={{ fontSize: 9, color: '#04140E', fontWeight: '900' }}>✓</Text>}
                  </View>

                  {/* 单张移回 */}
                  <Pressable
                    onPress={() => s.restore(t.item.id)}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.restore,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={styles.restoreText}>移回</Text>
                  </Pressable>

                  <Text style={styles.cellSize}>
                    {sizes[t.item.id] ? fmtSize(sizes[t.item.id]) : ''}
                  </Text>
                </Pressable>
              );
            }}
          />

          <View style={[styles.footer, { borderTopColor: c.line }]}>
            <Button label="全部移回" tone="ghost" onPress={s.restoreAll} style={{ flex: 1 }} />
            <View style={{ width: 10 }} />
            <Button
              label={selected.length ? `彻底清理 ${selected.length} 张` : '未勾选任何照片'}
              tone="trash"
              disabled={!selected.length}
              onPress={() => setConfirm(true)}
              style={{ flex: 1.55 }}
            />
          </View>
        </>
      )}

      <ConfirmSheet
        visible={confirm}
        title={`彻底清理 ${selected.length} 张照片？`}
        desc={`将从手机相册永久删除，约释放 ${selectedSize ? fmtSize(selectedSize) : '若干'} 空间，无法撤销。`}
        confirmText="确认清理"
        danger
        busy={s.busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await s.cleanup();
        }}
        extra={
          <View style={[styles.warnBox, { backgroundColor: c.trashSoft }]}>
            <Text style={{ color: c.trash, fontSize: 11.5, lineHeight: 17 }}>
              接下来安卓会弹出系统确认框，那一步点「允许」才真正删除；
              点「取消」则一张都不会少。
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 12.5, marginTop: 4 },
  summary: {
    marginHorizontal: 18,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sumNum: { fontSize: 20, fontWeight: '800' },
  sumUnit: { fontSize: 12, fontWeight: '600' },
  sumSub: { fontSize: 11.5, marginTop: 3 },
  selectAll: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11 },
  gridContent: { paddingHorizontal: H_PAD, paddingBottom: 8, gap: GAP },
  cell: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  check: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restore: {
    position: 'absolute',
    top: 5,
    right: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  restoreText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '700' },
  cellSize: {
    position: 'absolute',
    left: 6,
    bottom: 5,
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 10 },
  emptyDesc: { fontSize: 12.5, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  warnBox: { borderRadius: 12, padding: 10, marginTop: 4 },
});
