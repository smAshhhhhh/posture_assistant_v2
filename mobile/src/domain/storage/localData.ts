import { readNumber, readObject, readString } from '../observations/poseRecording';

export type LocalDataScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'patient'; readonly id: string }
  | { readonly kind: 'observation'; readonly id: string };

export interface LocalDataStats {
  readonly patients: number;
  readonly assessments: number;
  readonly observations: number;
  readonly databaseBytes: number;
  readonly poseBytes: number;
  readonly videoBytes: number;
  readonly photoBytes: number;
  readonly orphanFiles: number;
}

export interface DeletionPreview {
  readonly token: string;
  readonly patients: number;
  readonly assessments: number;
  readonly observations: number;
}

function count(value: unknown): number {
  const number = readNumber(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('本地数据统计不正确');
  return number;
}

export function parseLocalDataStats(value: unknown): LocalDataStats {
  const data = readObject(value);
  return {
    patients: count(data.patients),
    assessments: count(data.assessments),
    observations: count(data.observations),
    databaseBytes: count(data.databaseBytes),
    poseBytes: count(data.poseBytes),
    videoBytes: data.videoBytes === undefined ? 0 : count(data.videoBytes),
    photoBytes: data.photoBytes === undefined ? 0 : count(data.photoBytes),
    orphanFiles: count(data.orphanFiles),
  };
}

export function parseDeletionPreview(value: unknown): DeletionPreview {
  const data = readObject(value);
  const token = readString(data.token);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('删除范围校验信息不正确');
  return {
    token,
    patients: count(data.patients),
    assessments: count(data.assessments),
    observations: count(data.observations),
  };
}

export interface LocalDataRepository {
  readonly isAvailable: boolean;
  stats(): Promise<LocalDataStats>;
  previewDeletion(scope: LocalDataScope): Promise<DeletionPreview>;
  delete(scope: LocalDataScope, token: string): Promise<LocalDataStats>;
  export(scope: LocalDataScope, includePose: boolean): Promise<'saved' | 'cancelled'>;
  cleanOrphans(): Promise<LocalDataStats>;
}

export function getLocalDataError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'STORE_UNAVAILABLE') return '请重新构建安装包，加载本地数据管理功能。';
  if (code === 'CONFLICT') return '资料已发生变化，请重新核对删除范围。';
  if (code === 'NOT_FOUND') return '所选资料已不存在，请返回刷新。';
  if (code === 'DATA_CORRUPT') return '记录文件缺失或校验失败，导出未完成。';
  if (code === 'BUSY') return '正在处理另一项文件操作，请稍后重试。';
  return '本地数据操作未完成，请重试。';
}
