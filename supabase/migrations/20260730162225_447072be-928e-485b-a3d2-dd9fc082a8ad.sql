DELETE FROM public.payment_events;
DELETE FROM public.subscriptions;

ALTER TABLE public.subscriptions RENAME COLUMN paddle_subscription_id TO stripe_subscription_id;
ALTER TABLE public.subscriptions RENAME COLUMN paddle_customer_id TO stripe_customer_id;
ALTER TABLE public.payment_events RENAME COLUMN paddle_event_id TO provider_event_id;