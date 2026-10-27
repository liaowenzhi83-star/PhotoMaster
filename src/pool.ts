/**
 * 选卡算法（纯函数，不依赖 React / 原生模块，可单独做单元测试）。
 *
 * 这里负责回答三个问题：
 * 1. 现在有哪些照片是可整理的？      → buildPool
 * 2. 这一批该拿哪几张？              → pickBatch
 * 3. 畅刷模式滑完了，接下来接哪几张？ → nextChunk
 *
 * 之所以能"最新优先、不够自动往更早回溯、绝不重复"，靠的是同一个前提：
 * 相册列表本身按拍摄时间倒序，池子里只剩下没处理过的照片。
 */
import { MODES } from './types';
import type { PhotoItem, SessionMode } from './types';

/** 畅刷模式每次续卡的张数 */
export const INF_CHUNK = 30;

/**
 * 待整理池。
 * @param library 整个相册，必须已按拍摄时间倒序
 * @param isHandled 这张是否已经被用户处理过（保留或删除都算）
 */
export function buildPool(library: PhotoItem[], isHandled: (id: string) => boolean): PhotoItem[] {
  const out: PhotoItem[] = [];
  for (const it of library) {
    if (!isHandled(it.id)) out.push(it);
  }
  return out;
}

/**
 * 取一批卡片。
 * - 轻松 / 进阶：最多 N 张；池子不足 N 张时就是池子全部（自动接上更早的历史照片）
 * - 畅刷：先给一小段，滑完再续
 */
export function pickBatch(pool: PhotoItem[], mode: SessionMode, chunk: number = INF_CHUNK): PhotoItem[] {
  const limit = MODES[mode].count;
  const size = Number.isFinite(limit) ? Math.min(limit, pool.length) : Math.min(pool.length, chunk);
  return pool.slice(0, size);
}

/** 畅刷续卡：从池子里取还没进过本轮队列的一段，保证同一轮内不重复 */
export function nextChunk(pool: PhotoItem[], queued: Set<string>, chunk: number = INF_CHUNK): PhotoItem[] {
  const out: PhotoItem[] = [];
  for (const it of pool) {
    if (queued.has(it.id)) continue;
    out.push(it);
    if (out.length >= chunk) break;
  }
  return out;
}
