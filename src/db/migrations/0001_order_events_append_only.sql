-- order_events is an append-only audit log
-- This trigger prevents any UPDATE or DELETE on this table

CREATE OR REPLACE FUNCTION prevent_order_events_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'order_events is append-only: UPDATE is forbidden';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'order_events is append-only: DELETE is forbidden';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER order_events_no_update
  BEFORE UPDATE ON order_events
  FOR EACH ROW EXECUTE FUNCTION prevent_order_events_mutation();

CREATE TRIGGER order_events_no_delete
  BEFORE DELETE ON order_events
  FOR EACH ROW EXECUTE FUNCTION prevent_order_events_mutation();
