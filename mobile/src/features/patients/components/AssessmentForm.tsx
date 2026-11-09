import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  assessmentScales,
  createAssessmentDraft,
  validateAssessmentDraft,
} from '@/domain/patients/clinicalAssessment';
import type {
  AssessmentDraft,
  AssessmentValues,
  ClinicalAssessment,
} from '@/domain/patients/clinicalAssessment';
import { getPatientErrorMessage } from '@/domain/patients/patientRepository';
import { getLocalDate } from '@/domain/patients/patientRecord';
import { AppButton } from '@/shared/ui/AppButton';
import { AppDatePicker } from '@/shared/ui/AppDatePicker';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppRadioGroup } from '@/shared/ui/AppRadioGroup';
import { AppText } from '@/shared/ui/AppText';
import { AppTextField } from '@/shared/ui/AppTextField';

interface AssessmentFormProps {
  readonly current: ClinicalAssessment | null;
  readonly onSave: (values: AssessmentValues) => Promise<unknown>;
  readonly onDone: () => void;
  readonly onCancel: () => void;
  readonly onDirtyChange: (isDirty: boolean, isSaving: boolean) => void;
}

export function AssessmentForm({
  current,
  onSave,
  onDone,
  onCancel,
  onDirtyChange,
}: AssessmentFormProps) {
  const [initial] = useState(() => createAssessmentDraft(current));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mounted = useRef(true);
  const saving = useRef(false);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const selectedScale = assessmentScales.find((scale) => scale.id === draft.scale);
  const setField = <K extends keyof AssessmentDraft>(field: K, value: AssessmentDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: '',
      ...(field === 'scale' ? { score: '' } : {}),
    }));
    setError(null);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onDirtyChange(isDirty, isSaving);
  }, [isDirty, isSaving, onDirtyChange]);

  const save = async () => {
    if (saving.current) return;
    const validation = validateAssessmentDraft(draft);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    saving.current = true;
    setIsSaving(true);
    onDirtyChange(isDirty, true);
    setError(null);
    try {
      await onSave(validation.value);
      if (mounted.current) onDone();
    } catch (failure) {
      if (mounted.current) setError(getPatientErrorMessage(failure));
    } finally {
      saving.current = false;
      if (mounted.current) setIsSaving(false);
    }
  };

  return (
    <View className="gap-5">
      <AppText variant="section">{current ? '修改专业评估' : '录入专业评估'}</AppText>
      <AppRadioGroup
        label="量表版本"
        isRequired
        value={draft.scale}
        isDisabled={isSaving}
        options={assessmentScales.map((scale) => ({ value: scale.id, label: scale.name }))}
        onChange={(value) => setField('scale', value)}
        error={errors.scale}
      />
      <AppTextField
        label="总分"
        description={`填写 0–${selectedScale?.maxScore ?? 66} 的整数分数。`}
        isRequired
        value={draft.score}
        keyboardType="number-pad"
        maxLength={3}
        editable={!isSaving}
        onChangeText={(value) => setField('score', value)}
        error={errors.score}
      />
      <AppDatePicker
        label="评估日期"
        description="专业评估实际发生的日期，不能晚于今天。"
        isRequired
        value={draft.assessedOn}
        maximumDate={getLocalDate()}
        isDisabled={isSaving}
        onChange={(value) => setField('assessedOn', value)}
        error={errors.assessedOn}
      />
      <AppTextField
        label="评估者编号"
        description="记录本次专业评估者，最多 60 字。"
        isRequired
        value={draft.assessor}
        maxLength={60}
        editable={!isSaving}
        onChangeText={(value) => setField('assessor', value)}
        error={errors.assessor}
        placeholder="例如 T-03"
      />
      <AppTextField
        label="备注"
        description="选填，最多 500 字。"
        value={draft.notes}
        maxLength={500}
        multiline
        numberOfLines={4}
        editable={!isSaving}
        onChangeText={(value) => setField('notes', value)}
        error={errors.notes}
      />
      {error ? <AppNotice>{error}</AppNotice> : null}
      <AppButton isDisabled={isSaving} onPress={() => void save()}>
        {isSaving ? '正在保存…' : current ? '保存修改' : '保存评估记录'}
      </AppButton>
      <AppButton isDisabled={isSaving} onPress={onCancel} variant="secondary">
        {current ? '取消修改' : '取消录入'}
      </AppButton>
    </View>
  );
}
