DO $$
DECLARE
  r record;
  arr jsonb; m jsonb; seen jsonb; out_arr jsonb; idx int;
BEGIN
  FOR r IN SELECT id, chat_messages FROM public.projects WHERE chat_messages IS NOT NULL LOOP
    arr := r.chat_messages;
    seen := '{}'::jsonb; out_arr := '[]'::jsonb;
    FOR idx IN REVERSE jsonb_array_length(arr)-1 .. 0 LOOP
      m := arr->idx;
      IF NOT (seen ? (m->>'id')) THEN
        seen := seen || jsonb_build_object(m->>'id', true);
        out_arr := jsonb_build_array(m) || out_arr;
      END IF;
    END LOOP;
    IF jsonb_array_length(out_arr) <> jsonb_array_length(arr) THEN
      UPDATE public.projects SET chat_messages = out_arr WHERE id = r.id;
    END IF;
  END LOOP;
END $$;