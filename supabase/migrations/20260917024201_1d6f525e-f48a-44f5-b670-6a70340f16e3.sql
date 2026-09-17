ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS require_scan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scan_classes text[] NOT NULL DEFAULT '{}';

UPDATE public.tasks SET require_scan = true,
  scan_classes = ARRAY['book','laptop','keyboard','mouse','tv','cell phone','dining table','chair']
 WHERE cardinality(scan_classes) = 0 AND name ~* '(focus|study|read)';

UPDATE public.tasks SET require_scan = true,
  scan_classes = ARRAY['sports ball','bicycle','skateboard','tennis racket','frisbee','baseball bat','baseball glove','skis','snowboard','surfboard']
 WHERE cardinality(scan_classes) = 0 AND name ~* '(workout|gym|train|exercise)';

UPDATE public.tasks SET require_scan = true,
  scan_classes = ARRAY['toilet','sink','toothbrush','hair drier']
 WHERE cardinality(scan_classes) = 0 AND name ~* '(shower|bath|cold)';