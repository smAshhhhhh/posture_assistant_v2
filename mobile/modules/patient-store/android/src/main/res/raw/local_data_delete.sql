DELETE FROM observations
WHERE :kind = 'all'
   OR (:kind = 'patient' AND patient_id = :id)
   OR (:kind = 'observation' AND id = :id);

DELETE FROM clinical_assessments
WHERE :kind = 'all'
   OR (:kind = 'patient' AND patient_id = :id);

DELETE FROM patients
WHERE :kind = 'all'
   OR (:kind = 'patient' AND id = :id);
