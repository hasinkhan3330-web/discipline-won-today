CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paddle_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  subscription_id text,
  transaction_id text,
  amount integer,
  currency text,
  status text,
  environment text NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX idx_payment_events_subscription_id ON public.payment_events(subscription_id);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment events"
  ON public.payment_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages payment events"
  ON public.payment_events FOR ALL
  USING (auth.role() = 'service_role');