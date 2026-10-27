/**
 * 一次清理会话的状态机（home → swipe → review → done）。
 *
 * 关键设计（修复"保留过的照片又冒出来"的根因）：
 * - 每一张照片的处理结果都会立刻写进 decisions（持久化到本地文件），
 *   所以"划过一次就再也不出现"是跨会话、跨重启成立的，不依赖内存里的临时集合。
 * - 待整理池 = 整个相册按拍摄时间倒序 ∩ 未处理。
 *   取前 N 张自然就是"最新的、没整理过的"；新照片不够就顺着往更早的历史照片走，
 *   因为已处理的已经被剔除，永远不会回头重复。
 * - 池子空了且整册扫描完整 → 明确的"全部整理完毕"状态。
 *
 * 真正动到相册文件只发生在终审页点"彻底清理"、且系统弹窗确认之后。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { checkAccess, deletePhotos, expandAccess, loadAlbum, requestAccess } from './media';
import { clearPhotoCaches, peekSize } from './photos';
import {
  decidedCount,
  flush as flushDecisions,
  hydrate as hydrateDecisions,
  isDecided,
  markDecided,
  pruneDecided,
} from './decisions';
import { buildPool, nextChunk, pickBatch } from './pool';
import type { AccessLevel, Decision, Phase, PhotoItem, SessionMode, SessionResult, TrashEntry } from './types';

function tap(style: 'light' | 'medium' | 'success' | 'warn') {
  try {
    if (style === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (style === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* 部分设备无马达，忽略 */
  }
}

export function useSession() {
  const [access, setAccess] = useState<AccessLevel>('undetermined');
  const [library, setLibrary] = useState<PhotoItem[]>([]);
  const [albumComplete, setAlbumComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** 决策版本号：每记录/撤销一次决策就 +1，用来驱动待整理池重算 */
  const [rev, setRev] = useState(0);

  const [phase, setPhase] = useState<Phase>('home');
  const [mode, setMode] = useState<SessionMode>('easy');
  const [queue, setQueue] = useState<PhotoItem[]>([]);
  const [index, setIndex] = useState(0);
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [history, setHistory] = useState<{ item: PhotoItem; dir: Decision }[]>([]);
  const [result, setResult] = useState<SessionResult>({ cleaned: 0, freed: 0, kept: 0 });
  const [remain, setRemain] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /* ---------- 派生：待整理池 ---------- */

  const pending = useMemo(() => buildPool(library, isDecided), [library, rev]);

  // 依赖里带上 library：冷启动时 hydrate 完成后 library 才会更新，
  // 只依赖 rev 的话首屏会显示"已整理 0 张"
  const decidedTotal = useMemo(() => decidedCount(), [rev, library]);

  /* ---------- 回调里读最新值，避免闭包捕获旧状态 ---------- */

  const queueRef = useRef<PhotoItem[]>([]);
  const indexRef = useRef(0);
  const modeRef = useRef<SessionMode>('easy');
  const pendingRef = useRef<PhotoItem[]>([]);
  const historyRef = useRef<{ item: PhotoItem; dir: Decision }[]>([]);
  const phaseRef = useRef<Phase>('home');
  const trashRef = useRef<TrashEntry[]>([]);

  queueRef.current = queue;
  indexRef.current = index;
  modeRef.current = mode;
  pendingRef.current = pending;
  historyRef.current = history;
  phaseRef.current = phase;
  trashRef.current = trash;

  /* ---------- 权限与相册读取 ---------- */

  const load = useCallback(async () => {
    setLoading(true);
    const level = await checkAccess();
    setAccess(level);

    if (level === 'granted' || level === 'limited') {
      // 先把历史记录读进内存，再扫相册；顺序反了会把已处理的照片当成新照片推给用户
      await hydrateDecisions();
      clearPhotoCaches();

      const res = await loadAlbum((first) => setLibrary(first));
      setLibrary(res.items);
      setAlbumComplete(res.complete);

      // 剪枝：相册里已经不存在的 id 没必要一直留着。
      // 只在"扫完了整册 + 全量授权"时做，部分授权会把看不见的照片误判成已删除。
      if (res.complete && level === 'granted') {
        const alive = new Set(res.items.map((it) => it.id));
        if (pruneDecided(alive)) setRev((v) => v + 1);
      }

      setNotice(res.items.length ? null : '相册里还没有照片');
    } else if (level === 'denied') {
      setNotice('相册权限被拒绝，请到系统设置里打开');
    }

    setLoading(false);
  }, []);

  const grant = useCallback(async () => {
    setLoading(true);
    const level = await requestAccess();
    setAccess(level);
    setLoading(false);
    if (level === 'granted' || level === 'limited') {
      await load();
      tap('success');
    } else {
      setNotice('没有相册权限，无法读取照片');
      tap('warn');
    }
  }, [load]);

  /** Android 14+ "仅部分照片"：叫出系统选择器补选，而不是重新申请权限 */
  const grantMore = useCallback(async () => {
    await expandAccess();
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  /* 回到前台时重扫相册：新拍的照片才进得来；切后台时把决策落盘 */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (phaseRef.current === 'home') void load();
      } else {
        void flushDecisions();
      }
    });
    return () => {
      sub.remove();
      void flushDecisions();
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- 会话控制 ---------- */

  /**
   * 开始一批。队列 = 待整理池的前 N 张。
   * pending 本身已按拍摄时间倒序且剔除了处理过的，所以：
   * 新拍的照片排在最前；新照片不足 N 张时，后面自然接上更早的历史照片，
   * 且不会重复——已经处理过的根本不在池子里。
   */
  const start = useCallback((next: SessionMode) => {
    const pool = pendingRef.current;

    if (!pool.length) {
      setToast(albumComplete ? '照片已经全部整理完毕 🎉' : '暂时没有待整理的照片');
      tap('success');
      return;
    }

    const batch = pickBatch(pool, next);
    if (!batch.length) return;

    setMode(next);
    setQueue(batch);
    setIndex(0);
    setTrash([]);
    setHistory([]);
    setResult({ cleaned: 0, freed: 0, kept: 0 });
    setRemain(0);
    setPhase('swipe');
  }, [albumComplete]);

  const openReview = useCallback(() => {
    setPhase('review');
  }, []);

  /** 队列走完（或用户提前结束）→ 进入终审 */
  const advance = useCallback(() => {
    const q = queueRef.current;
    const next = indexRef.current + 1;

    if (next < q.length) {
      setIndex(next);
      return;
    }

    // 畅刷模式：队列用尽后，从"当前仍未处理"的池子里续一段
    if (modeRef.current === 'inf') {
      const queued = new Set(q.map((it) => it.id));
      const more = nextChunk(pendingRef.current, queued);
      if (more.length) {
        setQueue((prev) => [...prev, ...more]);
        setIndex(next);
        return;
      }
    }

    setIndex(next);
  }, []);

  const decide = useCallback(
    (dir: Decision) => {
      const item = queueRef.current[indexRef.current];
      if (!item) return;

      // ← 修复核心：任何一次选择都立刻记入本地历史，之后任何批次都不会再出现它
      markDecided(item.id);
      setRev((v) => v + 1);

      tap(dir === 'keep' ? 'light' : 'medium');
      setHistory((prev) => [...prev, { item, dir }]);
      if (dir === 'trash') {
        setTrash((prev) => [...prev, { item, selected: true, decisionAt: Date.now() }]);
      }
      advance();
    },
    [advance],
  );

  /** 撤销上一步：把决策也一并撤掉，这张照片才会重新回到待整理池 */
  const undo = useCallback(() => {
    const prev = historyRef.current;
    if (!prev.length) return;

    const last = prev[prev.length - 1];
    markDecided(last.item.id, false);
    setRev((v) => v + 1);

    setHistory((p) => p.slice(0, -1));
    if (last.dir === 'trash') {
      setTrash((p) => p.filter((t) => t.item.id !== last.item.id));
    }
    setIndex((p) => Math.max(0, p - 1));
    tap('light');
  }, []);

  /* 队列滑完自动进终审 */
  useEffect(() => {
    if (phase !== 'swipe') return;
    if (!queue.length) return;
    if (index < queue.length) return;
    setPhase('review');
  }, [phase, index, queue.length]);

  /* ---------- 终审复判 ---------- */

  const toggleSelect = useCallback((id: string) => {
    setTrash((prev) => prev.map((t) => (t.item.id === id ? { ...t, selected: !t.selected } : t)));
    tap('light');
  }, []);

  const selectAll = useCallback((selected: boolean) => {
    setTrash((prev) => prev.map((t) => ({ ...t, selected })));
  }, []);

  /** 移回 = 保留。它已经是"已处理"，不需要改决策，只是不再进删除列表 */
  const restore = useCallback((id: string) => {
    setTrash((prev) => prev.filter((t) => t.item.id !== id));
    setToast('已移回，这张会保留');
    tap('success');
  }, []);

  const restoreAll = useCallback(() => {
    if (!trashRef.current.length) return;
    setTrash([]);
    setToast('全部移回，什么都没删');
    tap('success');
  }, []);

  const cleanup = useCallback(async () => {
    const selected = trashRef.current.filter((t) => t.selected);
    if (!selected.length || busy) return;

    setBusy(true);
    // 删之前先把决策落盘，避免删到一半被杀进程导致历史丢失
    await flushDecisions();

    const outcome = await deletePhotos(selected.map((t) => t.item.id));
    setBusy(false);

    if (outcome.status === 'canceled') {
      setToast('已取消（系统未确认删除）');
      tap('warn');
      return;
    }
    if (outcome.status === 'error') {
      setToast(`删除失败：${outcome.message ?? '未知错误'}`);
      tap('warn');
      return;
    }

    const deleted = new Set(outcome.deletedIds);
    const freed = selected.reduce((sum, t) => (deleted.has(t.item.id) ? sum + peekSize(t.item.id) : sum), 0);
    const kept = historyRef.current.filter((h) => h.dir === 'keep').length;
    const leftOver = trashRef.current.filter((t) => !deleted.has(t.item.id)).length;

    setLibrary((prev) => prev.filter((p) => !deleted.has(p.id)));
    setTrash((prev) => prev.filter((t) => !deleted.has(t.item.id)));
    setResult({ cleaned: deleted.size, freed, kept });
    setRemain(leftOver);
    setRev((v) => v + 1);
    setPhase('done');
    tap('success');
  }, [busy]);

  const goHome = useCallback(() => {
    setPhase('home');
    setQueue([]);
    setIndex(0);
    setTrash([]);
    setHistory([]);
    void load();
  }, [load]);

  return {
    access,
    library,
    albumTotal: library.length,
    albumComplete,
    /** 待整理（未处理过）的张数 */
    pendingCount: pending.length,
    /** 累计已处理过的张数 */
    decidedTotal,
    /** 相册扫完了且没有待整理的 → 真正意义上的"全部整理完毕" */
    allDone: albumComplete && pending.length === 0,
    loading,
    notice,
    phase,
    mode,
    queue,
    index,
    trash,
    result,
    remain,
    busy,
    toast,
    setToast,
    grant,
    grantMore,
    load,
    start,
    decide,
    undo,
    openReview,
    toggleSelect,
    selectAll,
    restore,
    restoreAll,
    cleanup,
    goHome,
  };
}

export type Session = ReturnType<typeof useSession>;
