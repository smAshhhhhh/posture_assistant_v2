import { usePreventRemove } from '@react-navigation/native';
import { ControlField } from 'heroui-native/control-field';
import { FieldError } from 'heroui-native/field-error';
import { Label } from 'heroui-native/label';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import {
  createPatientDraft,
  getLocalDate,
  validatePatientDraft,
} from '@/domain/patients/patientRecord';
import type { PatientDraft, PatientProfile, PatientValues } from '@/domain/patients/patientRecord';
import { getPatientErrorMessage } from '@/domain/patients/patientRepository';
import type { PatientPhotoGateway } from '@/domain/patients/patientPhoto';
import { AppButton } from '@/shared/ui/AppButton';
import { useConfirmAction } from '@/shared/ui/AppConfirmationProvider';
import { AppDatePicker } from '@/shared/ui/AppDatePicker';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppRadioGroup } from '@/shared/ui/AppRadioGroup';
import { AppText } from '@/shared/ui/AppText';
import { AppTextField } from '@/shared/ui/AppTextField';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { PatientPhotoField } from '../components/PatientPhotoField';
import { usePatientPhoto } from '../hooks/usePatientPhoto';

interface PatientFormScreenProps {
  readonly patient: PatientProfile | undefined;
  readonly canSave: boolean;
  readonly photoGateway: PatientPhotoGateway;
  readonly onSave: (
    values: PatientValues,
    current: PatientProfile | null,
  ) => Promise<PatientProfile>;
  readonly onSaved: (patient: PatientProfile) => void;
  readonly onBack: () => void;
}

export function PatientFormScreen({
  patient,
  canSave,
  photoGateway,
  onSave,
  onSaved,
  onBack,
}: PatientFormScreenProps) {
  const confirmAction = useConfirmAction();
  const [initial] = useState(() => createPatientDraft(patient));
  const [originalPatient] = useState(patient ?? null);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedPatient, setSavedPatient] = useState<PatientProfile | null>(null);
  const [canDiscard, setCanDiscard] = useState(false);
  const mounted = useRef(true);
  const saving = useRef(false);
  const hasNavigated = useRef(false);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const setField = <K extends keyof PatientDraft>(field: K, value: PatientDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setSaveError(null);
  };
  const photo = usePatientPhoto(photoGateway, (uri) => setField('photoUri', uri));

  usePreventRemove(
    (isDirty || isSaving || photo.isChoosing) && !savedPatient && !canDiscard,
    () => {
      if (saving.current || photo.isChoosing) return;
      confirmAction({
        title: '放弃本次修改？',
        description: '尚未保存的内容将丢失。',
        cancelLabel: '继续编辑',
        confirmLabel: '放弃修改',
        isDestructive: true,
        onConfirm: () => setCanDiscard(true),
      });
    },
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (savedPatient && !hasNavigated.current) {
      hasNavigated.current = true;
      onSaved(savedPatient);
    }
  }, [onSaved, savedPatient]);
  useEffect(() => {
    if (canDiscard) onBack();
  }, [canDiscard, onBack]);

  const save = async () => {
    if (saving.current || photo.isChoosing || !canSave) return;
    const validation = validatePatientDraft(draft);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await onSave(validation.value, originalPatient);
      if (mounted.current) setSavedPatient(saved);
    } catch (error) {
      if (mounted.current) setSaveError(getPatientErrorMessage(error));
    } finally {
      saving.current = false;
      if (mounted.current) setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenLayout
        hasTabBar={false}
        header={<AppHeader title={patient ? '编辑患者' : '新建患者'} onBack={onBack} />}
        footer={
          <AppButton
            isDisabled={isSaving || photo.isChoosing || !canSave}
            onPress={() => void save()}
          >
            {isSaving ? '正在保存…' : '保存患者档案'}
          </AppButton>
        }
      >
        <AppText variant="title">{patient ? patient.patientCode : '建立本机档案'}</AppText>
        <AppText className="text-muted">使用患者编号，避免录入姓名和证件号码。</AppText>
        <PatientPhotoField
          patientCode={draft.patientCode}
          photoUri={draft.photoUri}
          isDisabled={isSaving || photo.isChoosing}
          isChoosing={photo.isChoosing}
          error={errors.photoUri || photo.error}
          onChoose={() => void photo.choose()}
          onRemove={() => setField('photoUri', null)}
        />
        <AppTextField
          label="患者编号"
          description="使用 2–32 位字母、数字、短横线或下划线。"
          isRequired
          value={draft.patientCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={32}
          editable={!isSaving}
          onChangeText={(value) => setField('patientCode', value)}
          error={errors.patientCode}
          placeholder="例如 PA-0087"
        />
        <AppRadioGroup
          label="患侧"
          isRequired
          value={draft.affectedSide}
          isDisabled={isSaving}
          options={[
            { value: 'left', label: '左侧' },
            { value: 'right', label: '右侧' },
          ]}
          onChange={(value) => setField('affectedSide', value)}
          error={errors.affectedSide}
        />
        <AppTextField
          label="年龄（岁）"
          description="选填，填写 0–120 的整数；未知时留空。"
          value={draft.ageYears}
          keyboardType="number-pad"
          maxLength={3}
          editable={!isSaving}
          onChangeText={(value) => setField('ageYears', value)}
          error={errors.ageYears}
          placeholder="未知时留空"
        />
        <AppDatePicker
          label="发病日期"
          description="选填，不能晚于今天。"
          value={draft.onsetDate}
          maximumDate={getLocalDate()}
          isDisabled={isSaving}
          onChange={(value) => setField('onsetDate', value)}
          error={errors.onsetDate}
        />
        <AppRadioGroup
          label="运动能力等级"
          description="由治疗师评定，不根据相机识别或量表总分自动推断。"
          value={draft.abilityLevel ?? 'unassessed'}
          isDisabled={isSaving}
          options={[
            { value: 'unassessed', label: '待专业评定' },
            { value: 'mild', label: '轻度' },
            { value: 'moderate', label: '中度' },
            { value: 'severe', label: '重度' },
          ]}
          onChange={(value) => {
            setField('abilityLevel', value === 'unassessed' ? null : value);
            if (value !== 'unassessed' && !draft.abilityAssessedOn) {
              setField('abilityAssessedOn', getLocalDate());
            }
          }}
          error={errors.abilityLevel}
        />
        {draft.abilityLevel ? (
          <>
            <AppTextField
              label="评定者编号"
              description="记录本次专业评定者，最多 60 字。"
              isRequired
              value={draft.abilityAssessor}
              maxLength={60}
              editable={!isSaving}
              onChangeText={(value) => setField('abilityAssessor', value)}
              error={errors.abilityAssessor}
              placeholder="例如 T-03"
            />
            <AppDatePicker
              label="评定日期"
              description="专业评定实际发生的日期，不能晚于今天。"
              isRequired
              value={draft.abilityAssessedOn}
              maximumDate={getLocalDate()}
              isDisabled={isSaving}
              onChange={(value) => setField('abilityAssessedOn', value)}
              error={errors.abilityAssessedOn}
            />
          </>
        ) : null}
        <ControlField
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.hasConsent }}
          className="min-h-[52px] gap-3"
          isDisabled={isSaving}
          isRequired
          isInvalid={Boolean(errors.hasConsent)}
          isSelected={draft.hasConsent}
          onSelectedChange={(value) => setField('hasConsent', value)}
        >
          <ControlField.Indicator variant="checkbox" />
          <Label className="flex-1 text-base">已说明本地数据用途并取得患者授权</Label>
        </ControlField>
        <FieldError
          isInvalid={Boolean(errors.hasConsent)}
          textProps={{ accessibilityRole: 'alert', accessibilityLiveRegion: 'polite' }}
        >
          {errors.hasConsent}
        </FieldError>
        {saveError ? <AppNotice>{saveError}</AppNotice> : null}
        {!canSave ? (
          <AppNotice status="warning">请先完成患者存储模块的构建与加载。</AppNotice>
        ) : null}
      </ScreenLayout>
    </KeyboardAvoidingView>
  );
}
