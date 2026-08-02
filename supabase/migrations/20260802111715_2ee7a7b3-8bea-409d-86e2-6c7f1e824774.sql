-- 1. Make Stripe-specific columns optional
ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_id DROP NOT NULL,
  ALTER COLUMN product_id DROP NOT NULL;

-- 2. Provider-agnostic columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS short_url text;

-- Backfill existing rows as stripe
UPDATE public.subscriptions
  SET provider = 'stripe',
      provider_subscription_id = COALESCE(provider_subscription_id, stripe_subscription_id),
      provider_customer_id = COALESCE(provider_customer_id, stripe_customer_id)
  WHERE provider_subscription_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub_uidx
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- 3. Razorpay plan cache
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay',
  environment text NOT NULL,
  price_key text NOT NULL,
  plan_id text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL,
  period text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX billing_plans_key_uidx
  ON public.billing_plans (provider, environment, price_key);

GRANT ALL ON public.billing_plans TO service_role;

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_plans_service_all ON public.billing_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER billing_plans_set_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
