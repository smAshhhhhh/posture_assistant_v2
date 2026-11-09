import { useState } from 'react';

import { designObservations, designPatients } from '@/dev/designFixtures';
import type { ObservationSummary } from '@/domain/observations/types';
import type { PatientSummary } from '@/domain/patients/types';
import { defaultRehabTask } from '@/domain/tasks/taskCatalog';
import type { RehabTask } from '@/domain/tasks/taskCatalog';

const isDesignPreview = __DEV__ && process.env.EXPO_PUBLIC_DESIGN_PREVIEW === '1';

export function useWorkspace() {
  const patients: readonly PatientSummary[] = isDesignPreview ? designPatients : [];
  const observations: readonly ObservationSummary[] = isDesignPreview ? designObservations : [];
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    patients[0]?.id ?? null,
  );
  const [task, setTask] = useState<RehabTask>(defaultRehabTask);
  const patient = patients.find((item) => item.id === selectedPatientId) ?? null;
  const patientObservations = observations.filter((item) => item.patientId === selectedPatientId);
  const selectPatient = (patientId: string) => {
    if (patients.some((item) => item.id === patientId)) {
      setSelectedPatientId(patientId);
    }
  };

  return {
    isDesignPreview,
    patients,
    patient,
    task,
    patientObservations,
    latestObservation: patientObservations[0] ?? null,
    selectPatient,
    selectTask: setTask,
  };
}
