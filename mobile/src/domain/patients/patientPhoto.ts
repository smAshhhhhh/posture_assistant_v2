export interface PatientPhotoGateway {
  readonly isAvailable: boolean;
  choose(): Promise<string | null>;
  discard(uri: string): Promise<void>;
}

export function getPatientPhotoError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'PHOTO_UNAVAILABLE') return '请重新构建安装包，加载患者照片功能。';
  if (code === 'BUSY') return '正在选择照片，请稍候。';
  if (code === 'INVALID_IMAGE') return '无法读取这张图片，请选择有效图片（不超过 20 MB）。';
  return '选择照片失败，请重试；当前填写内容已保留。';
}
