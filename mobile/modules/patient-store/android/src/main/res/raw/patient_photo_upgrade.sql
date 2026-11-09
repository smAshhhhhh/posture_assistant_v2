ALTER TABLE patients ADD COLUMN photo_file TEXT
CHECK (photo_file IS NULL OR length(photo_file) = 40);
