/**
 * 已处理记录的本地持久化 —— 「划过就永不重复」的唯一依据。
 * ------------------------------------------------------------------
 * 设计要点：
 * 1. 只要用户对某张照片做出选择（左滑保留 / 右滑删除），立刻写入这个 Set，
 *    会话结束、杀进程、重启手机都不会丢，后续任何批次都据此过滤。
 * 2. 落在 documentDirectory 下的纯文本文件（一行一个 assetId）。
 *    相比 AsyncStorage 的键值存储，这种"整体读写"更适合上万个 id，
 *    也不引入额外原生依赖（expo-file-system 项目里已经有了）。
 * 3. 写盘做 700ms 防抖 + 串行化，滑动过程不会因为频繁 IO 掉帧；
 *    同时在 App 切到后台时强制 flush 一次，避免被系统杀掉丢数据。
 * 4. 先写临时文件再 move 覆盖，避免写到一半崩溃把整份历史弄坏。
 */
import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'photosweep-decisions.txt';
const TEMP_NAME = 'photosweep-decisions.tmp';
/** 首行标记，用来识别文件格式；解析时跳过所有 # 开头的行 */
const MAGIC = '#psd1';
const DEBOUNCE_MS = 700;

let decided: Set<string> | null = null;
let hydrating: Promise<Set<string>> | null = null;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function dest(): File {
  return new File(Paths.document, FILE_NAME);
}

/* ---------------- 读 ---------------- */

/** 载入历史记录（只做一次，之后走内存）。文件损坏时退化为空历史，不阻塞使用。 */
export function hydrate(): Promise<Set<string>> {
  if (decided) return Promise.resolve(decided);
  if (hydrating) return hydrating;

  hydrating = (async () => {
    const set = new Set<string>();
    try {
      const f = dest();
      if (f.exists) {
        const text = await f.text();
        for (const raw of text.split('\n')) {
          const line = raw.trim();
          if (!line || line.startsWith('#')) continue;
          set.add(line);
        }
      }
    } catch {
      /* 读失败按空历史处理 */
    }
    decided = set;
    return set;
  })();

  return hydrating;
}

/* ---------------- 查 ---------------- */

export function isDecided(id: string): boolean {
  return decided?.has(id) ?? false;
}

export function decidedCount(): number {
  return decided?.size ?? 0;
}

/* ---------------- 写 ---------------- */

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, DEBOUNCE_MS);
}

function persist(): Promise<void> {
  if (!decided || !dirty) return Promise.resolve();
  dirty = false;

  const body = `${MAGIC}\n${Array.from(decided).join('\n')}`;

  return (async () => {
    try {
      const tmp = new File(Paths.document, TEMP_NAME);
      if (!tmp.exists) tmp.create({ intermediates: true, overwrite: true });
      await tmp.write(body);
      // 同目录内 move，本质是原子 rename，不会出现半份文件
      await tmp.move(dest(), { overwrite: true });
    } catch {
      // move 失败（个别机型 SAF 限制）时退化为直接覆写
      try {
        const f = dest();
        if (!f.exists) f.create({ intermediates: true, overwrite: true });
        await f.write(body);
      } catch {
        dirty = true; // 保留脏标记，下次再试
      }
    }
  })();
}

/** 记录/撤销一个决策。value=false 表示撤销（照片要重新回到待整理池）。 */
export function markDecided(ids: string | string[], value = true): void {
  if (!decided) decided = new Set<string>();
  const list = Array.isArray(ids) ? ids : [ids];
  for (const id of list) {
    if (!id) continue;
    if (value) decided.add(id);
    else decided.delete(id);
  }
  dirty = true;
  schedule();
}

/**
 * 剪枝：把相册里已经不存在的 id 从历史里删掉（系统相册/别的 App 删掉了照片）。
 * 只有在"完整扫描过相册 + 全量授权"时才允许调用，
 * 否则部分授权会误删历史，导致照片重新冒出来。
 * @returns 是否真的删掉了东西（调用方据此决定要不要刷新 UI）
 */
export function pruneDecided(aliveIds: Set<string>): boolean {
  if (!decided) return false;
  let removed = 0;
  for (const id of Array.from(decided)) {
    if (!aliveIds.has(id)) {
      decided.delete(id);
      removed += 1;
    }
  }
  if (removed) {
    dirty = true;
    schedule();
  }
  return removed > 0;
}

/** 立即落盘（切后台、开始删除等关键节点调用） */
export function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  writeChain = writeChain.then(persist);
  return writeChain;
}

/** 调试/极端情况下清空历史（暂未在 UI 暴露） */
export function clearDecisions(): void {
  decided = new Set<string>();
  dirty = true;
  schedule();
}
