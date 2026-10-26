/**
 * 照片的"重"信息（真实 uri + 文件大小）惰性解析。
 *
 * MediaStore 的批量元数据查询里没有文件路径和字节数，逐个取会拖慢首屏，
 * 所以只对"当前要显示的那几张"按需解析，并按 id 缓存。
 * 解析不到时（部分授权 / 特殊机型）UI 会显示占位或 "—"，绝不编造数字。
 */
import { useEffect, useState } from 'react';
import { File } from 'expo-file-system';
import { resolveUri } from './media';
import type { PhotoItem } from './types';

const uriCache = new Map<string, string>();
const sizeCache = new Map<string, number>();
const failed = new Set<string>();

export function peekUri(id: string): string | undefined {
  return uriCache.get(id);
}

export function peekSize(id: string): number {
  return sizeCache.get(id) ?? 0;
}

function readSize(uri: string): number {
  try {
    // expo-file-system v58：元数据走 info()，没有直接的 size getter
    const info = (new File(uri) as unknown as { info: () => { size?: number } }).info();
    const size = info?.size ?? 0;
    return typeof size === 'number' && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}

async function loadOne(item: PhotoItem): Promise<void> {
  if (failed.has(item.id)) return;
  try {
    if (!uriCache.has(item.id)) {
      const uri = await resolveUri(item.id);
      if (!uri) {
        failed.add(item.id);
        return;
      }
      uriCache.set(item.id, uri);
    }
    const uri = uriCache.get(item.id);
    if (uri && !sizeCache.has(item.id)) {
      sizeCache.set(item.id, readSize(uri));
    }
  } catch {
    failed.add(item.id);
  }
}

/**
 * 传入当前需要展示的照片，返回 { uris, sizes }。
 * 渐进式补齐：先返回已缓存的，解析完成的再触发一次重渲染。
 */
export function usePhotoDetails(items: PhotoItem[]) {
  const [, bump] = useState(0);
  const key = items.map((i) => i.id).join('|');

  useEffect(() => {
    const todo = items.filter((it) => !uriCache.has(it.id) && !failed.has(it.id));
    if (!todo.length) return;

    let canceled = false;
    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length && !canceled) {
        await loadOne(todo[cursor++]);
      }
    };

    Promise.all(Array.from({ length: Math.min(6, todo.length) }, worker)).then(() => {
      if (!canceled) bump((v) => v + 1);
    });

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const uris: Record<string, string> = {};
  const sizes: Record<string, number> = {};
  for (const it of items) {
    const u = uriCache.get(it.id);
    if (u) uris[it.id] = u;
    const s = sizeCache.get(it.id) ?? 0;
    if (s) sizes[it.id] = s;
  }

  return { uris, sizes, pending: items.some((it) => !uriCache.has(it.id) && !failed.has(it.id)) };
}

/** 清空缓存（回到首页重新扫描相册时调用，避免持有已删除资源的路径） */
export function clearPhotoCaches(): void {
  uriCache.clear();
  sizeCache.clear();
  failed.clear();
}
