import type { AssessmentValues, ClinicalAssessment } from './clinicalAssessment';
import type { PatientProfile, PatientValues } from './patientRecord';

export interface PatientRepository {
  readonly isAvailable: boolean;
  readonly supportsAssessmentManagement: boolean;
  list(): Promise<readonly PatientProfile[]>;
  save(values: PatientValues, current: PatientProfile | null): Promise<PatientProfile>;
  listAssessments(patientId: string): Promise<readonly ClinicalAssessment[]>;
  addAssessment(patientId: string, values: AssessmentValues): Promise<ClinicalAssessment>;
  updateAssessment(
    current: ClinicalAssessment,
    values: AssessmentValues,
  ): Promise<ClinicalAssessment>;
  deleteAssessment(current: ClinicalAssessment): Promise<void>;
}

export function getPatientErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'DUPLICATE_CODE') return '该患者编号已经存在，请使用其他编号。';
  if (code === 'CONFLICT') return '档案已被更新，请返回并重新打开后编辑。';
  if (code === 'ASSESSMENT_CONFLICT')
    return '这条评估已被修改，未执行本次操作。请重新读取记录后再试。';
  if (code === 'ASSESSMENT_NOT_FOUND') return '这条评估已不存在，请返回评估列表重新读取。';
  if (code === 'ASSESSMENT_UNAVAILABLE')
    return '评估修改与删除需要新版存储模块，请重新构建并安装 Android 应用。';
  if (code === 'BUSY') return '正在处理评估记录，请稍候再操作。';
  if (code === 'NOT_FOUND') return '该患者档案不存在，请返回患者列表刷新。';
  if (code === 'STORE_UNAVAILABLE')
    return '患者存储模块不可用，请确认使用已重新构建的 Android 安装包。';
  if (code === 'INVALID_RECORD') return '资料格式不正确，请检查填写内容。';
  if (code === 'PHOTO_UNAVAILABLE') return '请重新构建安装包，加载患者照片功能后再保存。';
  if (code === 'INVALID_IMAGE') return '照片无法保存，请重新选择图片后再试。';
  if (code === 'SCHEMA_UNSUPPORTED') return '数据库版本较新，请使用兼容的应用版本。';
  return '本机数据操作失败，请重试。未显示保存成功前，请保留当前填写内容。';
}
