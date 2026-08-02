DROP INDEX IF EXISTS public.subscriptions_provider_sub_uidx;
DROP INDEX IF EXISTS public.idx_subscriptions_paddle_id;

ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id;

DELETE FROM public.subscriptions WHERE provider_subscription_id IS NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN provider_subscription_id SET NOT NULL;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_sub_key UNIQUE (provider, provider_subscription_id);