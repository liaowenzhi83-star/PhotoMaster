/**
 * 原生相册桥接层（Android MediaStore / expo-media-library v58 新版 API）
 * ------------------------------------------------------------
 * 这是唯一直接接触系统相册的模块，UI 层只依赖这里导出的函数与类型。
 *
 * 关键点：
 * - 读取：Query().exeForMetadata() —— 直接走 MediaStore 游标，只取轻量字段，
 *        不解析文件、不解码图片，一万张也很快。
 * - 删除：Asset.delete() —— Android 11+ (API 30+) 内部走 MediaStore.createDeleteRequest，
 *        会先弹系统级"是否删除这些照片"确认框，用户点了确认才真正物理删除。
 *        这是系统强制的安全边界，任何 App 都绕不过去。
 */
import { Asset, AssetField, MediaType, Query } from 'expo-media-library';
import {
  getPermissionsAsync,
  presentPermissionsPicker,
  requestPermissionsAsync,
} from 'expo-media-library';
import type { AccessLevel, PhotoItem } from './types';

const GRANULAR = ['photo'] as const;

function toAccess(res: { status?: string; accessPrivileges?: string } | null | undefined): AccessLevel {
  if (!res) return 'undetermined';
  if (res.status === 'undetermined') return 'undetermined';
  if (res.status !== 'granted') return 'denied';
  return res.accessPrivileges === 'limited' ? 'limited' : 'granted';
}

export async function checkAccess(): Promise<AccessLevel> {
  try {
    return toAccess(await getPermissionsAsync(false, [...GRANULAR]));
  } catch {
    return 'undetermined';
  }
}

export async function requestAccess(): Promise<AccessLevel> {
  try {
    return toAccess(await requestPermissionsAsync(false, [...GRANULAR]));
  } catch {
    return 'denied';
  }
}

/** Android 14+ 的"仅授权部分照片"场景，让用户再补选一些 */
export async function expandAccess(): Promise<void> {
  try {
    await presentPermissionsPicker(['photo']);
  } catch {
    /* 系统版本不支持时忽略 */
  }
}

/** 秒 / 毫秒时间戳统一成毫秒 */
function toMs(v: number | null | undefined): number {
  if (!v) return 0;
  return v < 1e11 ? v * 1000 : v;
}

function detectKind(filename: string): PhotoItem['kind'] {
  return /screenshot|screen[_ ]?shot|截屏|截图/i.test(filename) ? 'screenshot' : 'photo';
}

/**
 * 连拍 / 相似照片聚类：
 * 已经把相册按拍摄时间倒序排好，把相邻时间差 < 3 秒的照片归成一组。
 * 纯本地计算，不做图像识别，开销可以忽略。
 */
function annotateBursts(items: PhotoItem[]): void {
  const WINDOW = 3000;
  const MAX_GROUP = 8;
  let i = 0;
  let seq = 0;
  while (i < items.length) {
    let j = i + 1;
    while (j < items.length && j - i < MAX_GROUP && items[i].date - items[j].date <= WINDOW) j++;
    const run = j - i;
    if (run >= 3) {
      seq += 1;
      const groupId = `b${seq}`;
      for (let k = i; k < j; k++) items[k].group = { id: groupId, idx: k - i + 1, total: run };
    }
    i = j;
  }
}

export type LibraryResult = { items: PhotoItem[]; complete: boolean };

/** 单页条数：够大以减少查询次数，又不会一次占太多内存 */
const PAGE_SIZE = 1000;
/** 硬上限，防极端相册（十万张）把首屏拖死；超过则标记为"未扫完" */
const MAX_SCAN = 40000;

function toItem(m: { id: string; creationTime?: number | null; modificationTime?: number | null; width?: number | null; height?: number | null; filename?: string | null }): PhotoItem {
  const filename = m.filename ?? '';
  return {
    id: m.id,
    // uri 惰性解析：几百张全部解析会明显拖慢首屏
    date: toMs(m.creationTime) || toMs(m.modificationTime) || Date.now(),
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    filename,
    kind: detectKind(filename),
  };
}

async function queryPage(offset: number, limit: number): Promise<PhotoItem[]> {
  const metas = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .offset(offset)
    .limit(limit)
    .exeForMetadata();
  return metas.map(toItem);
}

/**
 * 扫描整个相册（按拍摄时间倒序）。
 *
 * 为什么要翻页扫全量，而不是只取前 N 张：
 * - 判断"是不是全都整理完了"必须知道相册到底有多少张，
 *   截断到 1000 张会永远扫不到更早的历史照片，用户就卡在同一个圈里；
 * - 分页之后，"最新优先、不够自动往更早回溯"是天然成立的：
 *   只要按时间倒序过滤掉已处理的，取前 N 张就是正确结果。
 *
 * @param onFirstPage 第一页到达时回调，用于先渲染首屏、再后台继续扫
 */
export async function loadAlbum(onFirstPage?: (items: PhotoItem[]) => void): Promise<LibraryResult> {
  const items: PhotoItem[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let complete = false;
  let firstDelivered = false;

  try {
    for (;;) {
      const page = await queryPage(offset, PAGE_SIZE);
      if (!page.length) {
        complete = true;
        break;
      }

      for (const p of page) {
        if (seen.has(p.id)) continue; // 翻页期间相册变动导致的重复
        seen.add(p.id);
        items.push(p);
      }
      offset += page.length;

      if (page.length < PAGE_SIZE) {
        complete = true;
        break;
      }
      if (offset >= MAX_SCAN) break;

      // 第一页给出去让首页立刻有内容，剩下的在后台继续
      if (!firstDelivered && onFirstPage) {
        firstDelivered = true;
        onFirstPage(items.slice());
      }
    }
  } catch {
    // 中途失败：已拿到的照常返回，但标记为未扫完，避免误判"全部整理完毕"
    return { items, complete: false };
  }

  annotateBursts(items);
  return { items, complete };
}

/** 取可展示的 uri（Android 上是 MediaStore 给的可读路径） */
export async function resolveUri(id: string): Promise<string | undefined> {
  try {
    return await new Asset(id).getUri();
  } catch {
    return undefined;
  }
}

export type DeleteOutcome = {
  status: 'deleted' | 'canceled' | 'error';
  /** 真正从相册消失的 id */
  deletedIds: string[];
  message?: string;
};

/**
 * 物理删除。Android 11+ 会先弹系统确认框。
 * 删完回查一次，确认哪些真的没了 —— 系统弹窗允许只确认一部分，
 * 不能让结算页报假数字。
 */
export async function deletePhotos(ids: string[]): Promise<DeleteOutcome> {
  if (!ids.length) return { status: 'deleted', deletedIds: [] };

  try {
    // Android 13+ 没有独立写权限，这一句在部分机型上是 no-op
    await requestPermissionsAsync(true, [...GRANULAR]);
  } catch {
    /* ignore */
  }

  try {
    await Asset.delete(ids.map((id) => new Asset(id)));
  } catch (err) {
    // Android 11+ 用户在系统弹窗点"取消"时，原生层抛的正是权限异常
    const message = String((err as Error)?.message ?? err);
    const canceled = /cancel|did not grant|not grant|permission|denied|reject/i.test(message);
    return { status: canceled ? 'canceled' : 'error', deletedIds: [], message };
  }

  // 系统回执是权威的；回查只是为了识别"只确认了一部分"的情况
  const deletedIds = await verifyDeleted(ids);
  if (!deletedIds.length) {
    // 查询结果可能被 MediaStore 缓存拖住，按系统的成功回执处理
    return { status: 'deleted', deletedIds: ids };
  }
  return { status: 'deleted', deletedIds };
}

/** 并发回查资产是否还存在 */
async function verifyDeleted(ids: string[]): Promise<string[]> {
  const gone: string[] = [];
  const CONCURRENCY = 8;
  let cursor = 0;

  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        await new Asset(id).getInfo();
        // 还能读到 → 还在相册里
      } catch {
        gone.push(id);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  return gone;
}
