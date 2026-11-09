import { useEffect, useRef, useState } from 'react';

import { getPatientPhotoError } from '@/domain/patients/patientPhoto';
import type { PatientPhotoGateway } from '@/domain/patients/patientPhoto';

export function usePatientPhoto(gateway: PatientPhotoGateway, onChange: (uri: string) => void) {
  const [isChoosing, setIsChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const temporaryPhotos = useRef(new Set<string>());

  useEffect(() => {
    mounted.current = true;
    const photos = temporaryPhotos.current;
    return () => {
      mounted.current = false;
      photos.forEach((uri) => void gateway.discard(uri).catch(() => undefined));
      photos.clear();
    };
  }, [gateway]);

  const choose = async () => {
    if (busy.current) return;
    busy.current = true;
    setIsChoosing(true);
    setError(null);
    try {
      const uri = await gateway.choose();
      if (!uri) return;
      if (!mounted.current) {
        void gateway.discard(uri).catch(() => undefined);
        return;
      }
      temporaryPhotos.current.add(uri);
      onChange(uri);
    } catch (failure) {
      if (mounted.current) setError(getPatientPhotoError(failure));
    } finally {
      busy.current = false;
      if (mounted.current) setIsChoosing(false);
    }
  };

  return { choose, isChoosing, error };
}
