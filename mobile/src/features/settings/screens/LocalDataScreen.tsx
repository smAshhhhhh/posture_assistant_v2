import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { PatientSummary } from '@/domain/patients/types';
import type { LocalDataRepository, LocalDataScope } from '@/domain/storage/localData';
import { AppButton } from '@/shared/ui/AppButton';
import { useConfirmAction } from '@/shared/ui/AppConfirmationProvider';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import {
  AppListGroup,
  AppListItem,
  AppListSeparator,
  AppListSwitchItem,
} from '@/shared/ui/AppListGroup';
import { AppSelect } from '@/shared/ui/AppSelect';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { useLocalData } from '../hooks/useLocalData';

interface LocalDataScreenProps {
  readonly initialScope: LocalDataScope;
  readonly scopeLabel: string;
  readonly patients: readonly PatientSummary[];
  readonly repository: LocalDataRepository;
  readonly onDeleted: (scope: LocalDataScope) => Promise<void>;
  readonly onFinishedDelete: () => void;
  readonly onBack: () => void;
}

function bytes(value: number): string {
  return value < 1_024 * 1_024
    ? `${(value / 1_024).toFixed(1)} KB`
    : `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}

export function LocalDataScreen({
  initialScope,
  scopeLabel,
  patients,
  repository,
  onDeleted,
  onFinishedDelete,
  onBack,
}: LocalDataScreenProps) {
  const confirmAction = useConfirmAction();
  const [selectedId, setSelectedId] = useState('all');
  const [includePose, setIncludePose] = useState(false);
  const [hasDeleted, setHasDeleted] = useState(false);
  const data = useLocalData(repository);
  const scope: LocalDataScope =
    initialScope.kind !== 'all'
      ? initialScope
      : selectedId === 'all'
        ? initialScope
        : { kind: 'patient', id: selectedId };
  const label =
    initialScope.kind !== 'all'
      ? scopeLabel
      : selectedId === 'all'
        ? '全部本机资料'
        : `患者 ${patients.find((item) => item.id === selectedId)?.patientCode ?? '已移除'}`;
  const isBusy = data.busy !== null;
  usePreventRemove(isBusy, () => undefined);
  useEffect(() => {
    if (hasDeleted && !isBusy) onFinishedDelete();
  }, [hasDeleted, isBusy, onFinishedDelete]);
  const exportData = () =>
    confirmAction({
      title: '导出健康相关资料',
      description: `${label}将导出为未加密 ZIP，包含患者资料及报告${includePose ? '和关键点' : ''}。请选择可信的保存位置，当前不支持导入。`,
      confirmLabel: '选择保存位置',
      onConfirm: () => void data.exportData(scope, includePose),
    });

  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader title="本地数据" onBack={onBack} />}>
      <AppText variant="title">设备中的资料</AppText>
      {data.stats ? (
        <AppListGroup>
          <AppListItem
            title="资料数量"
            description={
              `患者 ${data.stats.patients} 位 · 评估 ${data.stats.assessments} 条` +
              ` · 观察 ${data.stats.observations} 条`
            }
          />
          <AppListSeparator />
          <AppListItem title="数据库" description={bytes(data.stats.databaseBytes)} />
          <AppListSeparator />
          <AppListItem title="关键点文件" description={bytes(data.stats.poseBytes)} />
          <AppListSeparator />
          <AppListItem title="原始视频" description={bytes(data.stats.videoBytes)} />
          <AppListSeparator />
          <AppListItem title="患者头像" description={bytes(data.stats.photoBytes)} />
          <AppListSeparator />
          <AppListItem title="统计范围" description="全部本机资料，不含离线模型和应用安装包。" />
        </AppListGroup>
      ) : null}
      <AppButton variant="secondary" isDisabled={isBusy} onPress={() => void data.refresh()}>
        刷新统计
      </AppButton>
      <AppText variant="section">操作范围</AppText>
      {initialScope.kind === 'all' ? (
        <AppSelect
          label="资料范围"
          value={selectedId}
          isDisabled={isBusy || data.preview !== null}
          options={[
            { value: 'all', label: '全部本机资料' },
            ...patients.map((patient) => ({ value: patient.id, label: patient.patientCode })),
          ]}
          onChange={setSelectedId}
        />
      ) : (
        <AppText>{label}</AppText>
      )}
      <AppText variant="section">导出资料</AppText>
      <AppCardStack>
        <AppListGroup>
          <AppListSwitchItem
            title="包含原始关键点文件"
            description="导出报告时附带本次范围内的关键点文件。"
            isSelected={includePose}
            isDisabled={isBusy}
            onChange={setIncludePose}
          />
          <AppListSeparator />
          <AppListItem
            title="导出范围与内容"
            description="报告本身也包含健康相关数据。导出包含患者头像，单条记录会附带所属患者资料；不包含原始视频。"
          >
            <View className="mt-2">
              <AppButton isDisabled={isBusy || !repository.isAvailable} onPress={exportData}>
                导出{label}
              </AppButton>
            </View>
          </AppListItem>
        </AppListGroup>
        <AppListGroup>
          <AppListItem
            title="删除资料"
            description="单条观察删除报告、对应关键点和原始视频；删除患者同时移除其头像、评估和全部观察。删除全部资料不会重置采集偏好。"
          >
            <View className="mt-2 gap-3">
              {data.preview ? (
                <>
                  <AppNotice status="warning" isInline>{`确认永久删除${label}？`}</AppNotice>
                  <AppText>
                    {data.preview.patients} 位患者、{data.preview.assessments} 条专业评估、
                    {data.preview.observations} 条观察及对应关键点和原始视频。此操作无法撤销。
                  </AppText>
                  <AppButton
                    variant="danger"
                    isDisabled={isBusy}
                    onPress={() =>
                      void data.deleteData(scope, async () => {
                        await onDeleted(scope);
                        setHasDeleted(true);
                      })
                    }
                  >
                    确认永久删除
                  </AppButton>
                  <AppButton variant="secondary" isDisabled={isBusy} onPress={data.cancelDeletion}>
                    取消删除
                  </AppButton>
                </>
              ) : (
                <AppButton
                  variant="secondary"
                  isDisabled={isBusy || !repository.isAvailable}
                  onPress={() => void data.previewDeletion(scope)}
                >
                  核对删除范围
                </AppButton>
              )}
            </View>
          </AppListItem>
        </AppListGroup>
        <AppListGroup>
          <AppListItem
            title={`孤立文件 · ${data.stats?.orphanFiles ?? '—'} 个`}
            description="清理已保存目录中没有档案或报告引用的头像、关键点和视频，不移除正在编辑的照片或等待保存的录像。"
          >
            <View className="mt-2">
              <AppButton
                variant="secondary"
                isDisabled={isBusy || !data.stats?.orphanFiles}
                onPress={() => void data.cleanOrphans()}
              >
                清理孤立文件
              </AppButton>
            </View>
          </AppListItem>
        </AppListGroup>
      </AppCardStack>
      {data.busy ? <AppLoading>{data.busy}</AppLoading> : null}
      {data.error ? <AppNotice>{data.error}</AppNotice> : null}
      {data.message ? <AppNotice status="default">{data.message}</AppNotice> : null}
      <AppText variant="caption" className="text-muted">
        卸载应用或清除应用数据会移除本机资料。导出文件保存在你选择的位置，需要自行保管和删除。
      </AppText>
    </ScreenLayout>
  );
}
