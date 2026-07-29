-- TASKS
DROP POLICY IF EXISTS "own tasks all" ON public.tasks;
CREATE POLICY "tasks_select_own" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TASK COMPLETIONS
DROP POLICY IF EXISTS "own completions" ON public.task_completions;
CREATE POLICY "task_completions_select_own" ON public.task_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "task_completions_insert_own" ON public.task_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_completions_update_own" ON public.task_completions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_completions_delete_own" ON public.task_completions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ALARMS
DROP POLICY IF EXISTS "own alarms" ON public.alarms;
CREATE POLICY "alarms_select_own" ON public.alarms FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alarms_insert_own" ON public.alarms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarms_update_own" ON public.alarms FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarms_delete_own" ON public.alarms FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ALARM SESSIONS
DROP POLICY IF EXISTS "own alarm sessions" ON public.alarm_sessions;
CREATE POLICY "alarm_sessions_select_own" ON public.alarm_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alarm_sessions_insert_own" ON public.alarm_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarm_sessions_update_own" ON public.alarm_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarm_sessions_delete_own" ON public.alarm_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PROFILES (owner column is id)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- SUBSCRIPTIONS (billing-owned: owner read only, system writes)
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_service_all" ON public.subscriptions FOR ALL TO service_role USING (auth.uid() IS NULL OR auth.uid() = user_id) WITH CHECK (true);

-- PAYMENT EVENTS (webhook-owned: owner read only, system writes)
DROP POLICY IF EXISTS "Users can view own payment events" ON public.payment_events;
DROP POLICY IF EXISTS "Service role manages payment events" ON public.payment_events;
CREATE POLICY "payment_events_select_own" ON public.payment_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "payment_events_service_all" ON public.payment_events FOR ALL TO service_role USING (auth.uid() IS NULL OR auth.uid() = user_id) WITH CHECK (true);

-- COIN TRANSACTIONS (append-only ledger, owner read only)
DROP POLICY IF EXISTS "own coin tx" ON public.coin_transactions;
CREATE POLICY "coin_transactions_select_own" ON public.coin_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- APP TRIALS (owner read + one-time start, no self-service edit/delete)
DROP POLICY IF EXISTS "Users can view own app trial" ON public.app_trials;
DROP POLICY IF EXISTS "Users can start own app trial" ON public.app_trials;
CREATE POLICY "app_trials_select_own" ON public.app_trials FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "app_trials_insert_own" ON public.app_trials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_trials ENABLE ROW LEVEL SECURITY;