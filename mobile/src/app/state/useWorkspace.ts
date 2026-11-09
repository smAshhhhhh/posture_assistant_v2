import { useState } from 'react';

import { patientRepository } from '@/data/patients/patientRepository';
import { observationRepository } from '@/data/observations/observationRepository';
import { preferencesRepository } from '@/data/settings/preferencesRepository';
import { localDataRepository } from '@/data/storage/localDataRepository';
import { useAppPreferences } from '@/features/settings/hooks/useAppPreferences';
import { useObservationRecords } from '@/features/history/hooks/useObservationRecords';
import { defaultRehabTask } from '@/domain/tasks/taskCatalog';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { usePatientRecords } from '@/features/patients/hooks/usePatientRecords';

export function useWorkspace() {
  const records = usePatientRecords(patientRepository);
  const history = useObservationRecords(observationRepository);
  const preferences = useAppPreferences(preferencesRepository);
  const observations = history.observations;
  const patients = records.patients.map((patient) => ({
    ...patient,
    lastObservedAt:
      observations.find((item) => item.patientId === patient.id)?.observedAt ??
      (history.status === 'ready' ? null : patient.lastObservedAt),
  }));
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [task, setTask] = useState<RehabTask>(defaultRehabTask);
  const patient = patients.find((item) => item.id === selectedPatientId) ?? patients[0] ?? null;
  const patientObservations = observations.filter((item) => item.patientId === patient?.id);
  const selectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
  };

  return {
    records,
    history,
    observationRepository,
    patientRepository,
    localDataRepository,
    preferences,
    refreshAll: async () => {
      await Promise.all([records.refresh(), history.refresh()]);
    },
    patients,
    patient,
    task,
    patientObservations,
    latestObservation: patientObservations[0] ?? null,
    selectPatient,
    selectTask: setTask,
  };
}
