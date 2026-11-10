CREATE TRIGGER observations_current_status_insert
BEFORE INSERT ON observations
WHEN NEW.task_status NOT IN ('completed', 'partial', 'assisted', 'unable')
BEGIN
  SELECT RAISE(ABORT, 'Only current task statuses can be saved');
END;

CREATE TRIGGER observations_current_status_update
BEFORE UPDATE OF task_status ON observations
WHEN NEW.task_status NOT IN ('completed', 'partial', 'assisted', 'unable')
BEGIN
  SELECT RAISE(ABORT, 'Only current task statuses can be saved');
END;
