import { usePreventRemove } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { assessmentScales } from '@/domain/patients/clinicalAssessment';
import type { ClinicalAssessment } from '@/domain/patients/clinicalAssessment';
import type { PatientProfile } from '@/domain/patients/patientRecord';
import type { PatientRepository } from '@/domain/patients/patientRepository';
import { AppButton } from '@/shared/ui/AppButton';
import { AppAvatar } from '@/shared/ui/AppAvatar';
import { useConfirmAction } from '@/shared/ui/AppConfirmationProvider';
import { AppCard } from '@/shared/ui/AppCard';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppText } from '@/shared/ui/AppText';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { AssessmentForm } from '../components/AssessmentForm';
import { useClinicalAssessments } from '../hooks/useClinicalAssessments';

interface ClinicalAssessmentsScreenProps {
  readonly patient: PatientProfile;
  readonly repository: PatientRepository;
  readonly onBack: () => void;
}

type AssessmentEditor =
  { readonly kind: 'create' } | { readonly kind: 'edit'; readonly record: ClinicalAssessment };

export function ClinicalAssessmentsScreen({
  patient,
  repository,
  onBack,
}: ClinicalAssessmentsScreenProps) {
  const confirmAction = useConfirmAction();
  const assessments = useClinicalAssessments(repository, patient.id);
  const [editor, setEditor] = useState<AssessmentEditor | null>(null);
  const [formState, setFormState] = useState({ isDirty: false, isSaving: false });
  const onDirtyChange = useCallback((isDirty: boolean, isSaving: boolean) => {
    setFormState({ isDirty, isSaving });
  }, []);
  const finish = () => {
    setEditor(null);
    setFormState({ isDirty: false, isSaving: false });
  };
  const closeForm = () => {
    if (formState.isSaving || assessments.isBusy) return;
    if (!formState.isDirty) {
      finish();
      return;
    }
    confirmAction({
      title: '放弃本次填写？',
      description: '尚未保存的评估内容将丢失。',
      cancelLabel: '继续填写',
      confirmLabel: '放弃填写',
      isDestructive: true,
      onConfirm: finish,
    });
  };
  usePreventRemove(editor !== null || assessments.isBusy, closeForm);
  const current = editor?.kind === 'edit' ? editor.record : null;
  const deleteRecord = (record: ClinicalAssessment) => {
    const scale = assessmentScales.find((item) => item.id === record.scale);
    confirmAction({
      title: '删除这条专业评估？',
      description:
        `患者 ${patient.patientCode}\n${scale?.name} · ${record.score} 分\n` +
        `${record.assessedOn} · 评估者 ${record.assessor}\n\n` +
        '仅删除这条评估，患者档案和观察报告会保留。删除后无法恢复。',
      confirmLabel: '删除评估',
      isDestructive: true,
      onConfirm: () => {
        if (!assessments.isBusy) void assessments.remove(record);
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenLayout
        hasTabBar={false}
        header={
          <AppHeader title="专业评估" onBack={editor || assessments.isBusy ? closeForm : onBack} />
        }
      >
        <View className="flex-row items-center gap-4">
          <AppAvatar label={patient.patientCode} imageUri={patient.photoUri} size="md" />
          <AppText className="flex-1" variant="title">
            {patient.patientCode}
          </AppText>
        </View>
        <AppText className="text-muted">由专业人员按量表标准流程评定后手动录入。</AppText>
        {editor ? (
          <AssessmentForm
            key={current?.id ?? 'new-assessment'}
            current={current}
            onSave={(values) => assessments.save(values, current)}
            onDone={finish}
            onCancel={closeForm}
            onDirtyChange={onDirtyChange}
          />
        ) : (
          <>
            {assessments.status === 'loading' ? <AppLoading>正在读取评估记录…</AppLoading> : null}
            {assessments.error ? <AppNotice>{assessments.error}</AppNotice> : null}
            {assessments.message ? (
              <AppNotice status="success">{assessments.message}</AppNotice>
            ) : null}
            {assessments.isBusy ? <AppLoading>正在处理评估记录…</AppLoading> : null}
            {!repository.supportsAssessmentManagement ? (
              <AppText className="text-muted">
                修改和删除评估需要重新构建安装 Android 应用，现有记录仍可查看和新增。
              </AppText>
            ) : null}
            {assessments.status === 'ready' && assessments.records.length === 0 ? (
              <EmptyState
                title="尚无专业评估记录"
                description="完成专业评定后，记录分数、日期与评估者。"
              />
            ) : null}
            {assessments.records.length > 0 ? (
              <AppCardStack>
                {assessments.records.map((record) => {
                  const scale = assessmentScales.find((item) => item.id === record.scale);
                  return (
                    <AppCard className="gap-2" key={record.id}>
                      <AppText variant="section">{scale?.name}</AppText>
                      <AppText>
                        {record.score} / {scale?.maxScore} 分
                      </AppText>
                      <AppText className="text-muted">
                        {record.assessedOn} · 评估者 {record.assessor}
                      </AppText>
                      {record.notes ? <AppText>{record.notes}</AppText> : null}
                      <View className="flex-row flex-wrap gap-2">
                        <AppButton
                          variant="secondary"
                          className="flex-1"
                          accessibilityLabel={`修改 ${record.assessedOn} 的${scale?.name}评估`}
                          isDisabled={
                            assessments.isBusy ||
                            assessments.status !== 'ready' ||
                            !repository.supportsAssessmentManagement
                          }
                          onPress={() => setEditor({ kind: 'edit', record })}
                        >
                          修改
                        </AppButton>
                        <AppButton
                          variant="danger-soft"
                          className="flex-1"
                          accessibilityLabel={`删除 ${record.assessedOn} 的${scale?.name}评估`}
                          isDisabled={
                            assessments.isBusy ||
                            assessments.status !== 'ready' ||
                            !repository.supportsAssessmentManagement
                          }
                          onPress={() => deleteRecord(record)}
                        >
                          删除
                        </AppButton>
                      </View>
                    </AppCard>
                  );
                })}
              </AppCardStack>
            ) : null}
            <AppButton
              isDisabled={assessments.status !== 'ready' || assessments.isBusy}
              onPress={() => setEditor({ kind: 'create' })}
            >
              录入专业评估
            </AppButton>
            <AppButton
              variant="secondary"
              isDisabled={assessments.isBusy || assessments.status === 'loading'}
              onPress={() => void assessments.refresh()}
            >
              重新读取记录
            </AppButton>
          </>
        )}
        <AppText variant="caption" className="text-muted">
          评估分数不会自动转换为患者能力等级或诊断结论。
        </AppText>
      </ScreenLayout>
    </KeyboardAvoidingView>
  );
}
