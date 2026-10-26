/* 统一的照片数据模型：原生层（MediaStore）与 UI 之间唯一的契约 */

export type PhotoItem = {
  /** MediaStore 的 assetId，删除时直接用它 */
  id: string;
  /** 用于 <Image> 展示的 uri，惰性解析（MediaStore 元数据查询不带真实路径） */
  uri?: string;
  /** 拍摄时间（毫秒时间戳） */
  date: number;
  /** 文件字节数，惰性解析 */
  size?: number;
  width?: number;
  height?: number;
  filename?: string;
  /** 连拍 / 相似照片分组信息（本地聚类得出） */
  group?: { id: string; idx: number; total: number };
  kind?: 'photo' | 'screenshot';
};

export type Decision = 'keep' | 'trash';

export type TrashEntry = {
  item: PhotoItem;
  /** 终审复判时是否仍勾选（默认勾选） */
  selected: boolean;
  decisionAt: number;
};

export type SessionMode = 'easy' | 'pro' | 'inf';

export type Phase = 'home' | 'swipe' | 'review' | 'done';

export type AccessLevel = 'granted' | 'limited' | 'denied' | 'undetermined';

export type SessionResult = {
  cleaned: number;
  freed: number;
  kept: number;
};

export const MODES: Record<SessionMode, { name: string; sub: string; count: number; icon: string }> = {
  easy: { name: '轻松', sub: '20 张，随手清一清', count: 20, icon: '🌿' },
  pro: { name: '进阶', sub: '50 张，一次到位', count: 50, icon: '⚡' },
  inf: { name: '畅刷', sub: '不限张数，滑到想停', count: Number.POSITIVE_INFINITY, icon: '∞' },
};
