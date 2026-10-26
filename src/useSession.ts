/**
 * 一次清理会话的状态机（home → swipe → review → done）。
 * 所有"决策"都只发生在内存里，只有用户在终审页点"彻底清理"、
 * 并且在系统弹窗里确认之后，才会真正动到相册文件。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { checkAccess, deletePhotos, expandAccess, loadLibrary, requestAccess } from './media';
import { clearPhotoCaches, peekSize } from './photos';
import { MODES } from './types';
import type { AccessLevel, Decision, Phase, PhotoItem, SessionMode, SessionResult, TrashEntry } from './types';

const LIBRARY_LIMIT = 1000;
const INF_CHUNK = 30;

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
  const [albumTotal, setAlbumTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  const served = useRef<Set<string>>(new Set());
  const trashRef = useRef<TrashEntry[]>([]);
  trashRef.current = trash;

  /* ---------- 权限与相册读取 ---------- */

  const load = useCallback(async () => {
    setLoading(true);
    const level = await checkAccess();
    setAccess(level);
    if (level === 'granted' || level === 'limited') {
      clearPhotoCaches();
      const res = await loadLibrary(LIBRARY_LIMIT);
      setLibrary(res.items);
      setAlbumTotal(res.total);
      setNotice(res.items.length ? null : '相册里还没有可整理的照片');
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

  useEffect(() => {
    load();
  }, [load]);

  /** Android 14+ "仅部分照片"：叫出系统选择器补选，而不是重新申请权限 */
  const grantMore = useCallback(async () => {
    await expandAccess();
    await load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- 会话控制 ---------- */

  const start = useCallback(
    (next: SessionMode) => {
      const limit = MODES[next].count;
      const size = Number.isFinite(limit) ? Math.min(limit, library.length) : Math.min(library.length, INF_CHUNK);
      const batch = library.slice(0, size);
      served.current = new Set(batch.map((b) => b.id));
      setMode(next);
      setQueue(batch);
      setIndex(0);
      setTrash([]);
      setHistory([]);
      setResult({ cleaned: 0, freed: 0, kept: 0 });
      setRemain(0);
      setPhase('swipe');
    },
    [library],
  );

  const openReview = useCallback(() => {
    setPhase('review');
  }, []);

  /** 队列走完（或用户提前结束）→ 进入终审 */
  const advance = useCallback(() => {
    const next = index + 1;
    if (next < queue.length) {
      setIndex(next);
      return;
    }

    // 畅刷模式：队列用尽后从相册里续一段没服务过的
    if (mode === 'inf') {
      const rest = library.filter((it) => !served.current.has(it.id));
      if (rest.length) {
        const chunk = rest.slice(0, INF_CHUNK);
        chunk.forEach((c) => served.current.add(c.id));
        setQueue((q) => [...q, ...chunk]);
        setIndex(next);
        return;
      }
    }

    setIndex(next);
  }, [index, queue.length, mode, library]);

  const decide = useCallback(
    (dir: Decision) => {
      const item = queue[index];
      if (!item) return;
      tap(dir === 'keep' ? 'light' : 'medium');
      setHistory((prev) => [...prev, { item, dir }]);
      if (dir === 'trash') {
        setTrash((prev) => [...prev, { item, selected: true, decisionAt: Date.now() }]);
      }
      advance();
    },
    [queue, index, advance],
  );

  const undo = useCallback(() => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    if (last.dir === 'trash') {
      setTrash((prev) => prev.filter((t) => t.item.id !== last.item.id));
    }
    setIndex((prev) => Math.max(0, prev - 1));
    tap('light');
  }, [history]);

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
    const selected = trash.filter((t) => t.selected);
    if (!selected.length || busy) return;

    setBusy(true);
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
    const kept = history.filter((h) => h.dir === 'keep').length;
    const leftOver = trashRef.current.filter((t) => !deleted.has(t.item.id)).length;

    setLibrary((prev) => prev.filter((p) => !deleted.has(p.id)));
    setAlbumTotal((prev) => Math.max(0, prev - deleted.size));
    setTrash((prev) => prev.filter((t) => !deleted.has(t.item.id)));
    setResult({ cleaned: deleted.size, freed, kept });
    setRemain(leftOver);
    setPhase('done');
    tap('success');
  }, [trash, history, busy]);

  const goHome = useCallback(() => {
    setPhase('home');
    setQueue([]);
    setIndex(0);
    setTrash([]);
    setHistory([]);
    load();
  }, [load]);

  return {
    access,
    library,
    albumTotal,
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
