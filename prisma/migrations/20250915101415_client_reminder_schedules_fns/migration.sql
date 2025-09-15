/*
  Warnings:

  - Added the required column `notifyType` to the `ClientReminder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notifyType` to the `ClientReminderQueue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClientReminder" ADD COLUMN     "notifyType" "ReminderNotificationOptOutType" NOT NULL;

-- AlterTable
ALTER TABLE "ClientReminderQueue" ADD COLUMN     "notifyType" "ReminderNotificationOptOutType" NOT NULL;

-- CreateIndex
CREATE INDEX "ClientReminder_clientPhone_targetMedium_notifyType_idx" ON "ClientReminder"("clientPhone", "targetMedium", "notifyType");

-- Resetea campos ONCE para una queue (día local)
CREATE OR REPLACE FUNCTION public.reset_once_for_client_reminder_queue(p_queue_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  q    public."ClientReminderQueue";
  day_local date;
  updated int := 0;
BEGIN
  SELECT * INTO q FROM public."ClientReminderQueue" WHERE id = p_queue_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  day_local := (now() AT TIME ZONE q.timezone)::date;

  UPDATE public."ClientReminder" r
      SET "receivedByBot" = false,
          "lastFailTimes" = 0,
          "lastFailTime" = NULL,
          "lastHttpCode" = NULL,
          "lastHttpResponse" = NULL,
          "sentLastDay" = (day_local::text || ' 00:00:00')::timestamptz,
          "status" = CASE
            WHEN q."maxCount" IS NULL OR r."successCount" < q."maxCount" THEN 'PENDING'
            ELSE r."status"
          END
    WHERE r."clientReminderQueueId" = p_queue_id
      AND (
            r."sentLastDay" IS NULL
            OR ((r."sentLastDay" AT TIME ZONE q.timezone)::date <> day_local)
          );

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;


-- Agendar UNA vez por día y resetear ONCE
CREATE OR REPLACE FUNCTION public.schedule_today_and_reset_once_crq()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  q                 public."ClientReminderQueue";
  inserted          int := 0;
  new_status        "ReminderQueueStatus";
  ts_now            timestamptz;  -- una sola captura por iteración
  local_day         date;         -- día local de la cola
  did_insert        boolean;
BEGIN
  FOR q IN
    SELECT r.*
    FROM public."ClientReminderQueue" r
    WHERE r.active = TRUE
      AND r."status" <> 'COMPLETED'
  LOOP
    -- Capturamos un "ahora" para esta cola y derivamos su 'local_day'
    ts_now    := now();
    local_day := (timezone(q.timezone, ts_now))::date;

    PERFORM pg_try_advisory_xact_lock(hashtextextended(q.id::text, 0));

    -- Estado “actual” calculado por tu función (mismo ts_now para consistencia)
    new_status := public._client_queue_status_now(q);

    IF new_status = 'COMPLETED' THEN
      UPDATE public."ClientReminderQueue"
         SET "status" = 'COMPLETED',
             "lastTimeChecked" = ts_now
       WHERE id = q.id;
      CONTINUE;
    END IF;

    -- ¿aplica hoy?
    IF public._client_queue_matches_today(q) THEN
      -- Inserta UNA sola vez por día (idempotente vía UNIQUE)
      WITH ins AS (
        INSERT INTO public."ScheduledClientReminderQueues" ("clientReminderQueueId","day")
        VALUES (q.id, local_day)
        ON CONFLICT ("clientReminderQueueId","day") DO NOTHING
        RETURNING 1
      )
      SELECT EXISTS(SELECT 1 FROM ins) INTO did_insert;

      IF did_insert THEN
        -- Reset ONCE para el día local de la cola
        PERFORM public.reset_once_for_client_reminder_queue(q.id);
        inserted := inserted + 1;
      END IF;
    END IF;

    -- Actualizar estado y marca de tiempo (usa el mismo ts_now)
    UPDATE public."ClientReminderQueue"
       SET "status" = new_status,
           "lastTimeChecked" = ts_now
     WHERE id = q.id;
  END LOOP;

  RETURN inserted;
END;
$$;

/*
Reserva de recordatorios (lotes) para el worker
Toma sólo queues agendadas para hoy y activas ahora (en ventana y día).
Excluye opt-out y stopReminders.
Marca cada fila como IN_PROGRESS y setea sentLastTime/sentLastDay.
Usa FOR UPDATE SKIP LOCKED (alta concurrencia con múltiples workers).
*/
CREATE OR REPLACE FUNCTION public.reserve_client_reminders(
  p_company_id text,
  p_batch int DEFAULT 100,
  p_retry_interval_minutes int DEFAULT 60
)
RETURNS TABLE (
  reminder_id uuid,
  company_id  text,
  queue_id    uuid,
  timezone    text,
  message     jsonb,       -- template combinado con CTA y datos mínimos
  phone       text,
  client_name text,
  call_actions text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  now_utc              timestamptz := now();
  qrec                 record;         -- traerá columnas de q + s.day
  local_midnight_utc   timestamptz;    -- 00:00:00 local en UTC
BEGIN
  FOR qrec IN
    SELECT
      q.*,
      s."day" AS sched_day  -- incluye el day del schedule (string)
    FROM public."ClientReminderQueue" q
    JOIN public."ScheduledClientReminderQueues" s
      ON s."clientReminderQueueId" = q."id"
    WHERE q."companyId" = p_company_id
      AND q."active" = TRUE
      AND q."status" <> 'COMPLETED'
      -- hoy según el huso de la cola (usa variable now_utc para consistencia)
      AND s."day" = (timezone(q."timezone", now_utc))::date::text
  LOOP
    -- Ventana horaria (asumo que tu fn maneja tz correctamente)
    IF NOT public._time_in_window(qrec."startHour", qrec."endHour", now_utc, qrec."timezone") THEN
      CONTINUE;
    END IF;

    -- Medianoche local como timestamptz consistente
    local_midnight_utc :=
      (date_trunc('day', timezone(qrec."timezone", now_utc))) AT TIME ZONE qrec."timezone";

    RETURN QUERY
    WITH cte AS (
      SELECT r."id"
      FROM public."ClientReminder" r
      WHERE r."clientReminderQueueId" = qrec."id"
        AND r."companyId" = p_company_id
        AND r."stopReminders" = FALSE
        AND (qrec."maxCount" IS NULL OR r."successCount" < qrec."maxCount")
        AND r."status" <> 'DONE'
        AND (
          r."sentLastTime" IS NULL
          OR now_utc > r."sentLastTime"
                       + make_interval(mins => p_retry_interval_minutes * (r."lastFailTimes" + 1))
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public."ReminderNotificationOptOut" o
          WHERE o."phone" = r."clientPhone"
            AND o."optOutType" = qrec."notifyType"
            AND o."optOutMedium" = qrec."targetMedium"
        )
      ORDER BY r."sourceRowNumber" NULLS LAST, r."createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT p_batch
    )
    UPDATE public."ClientReminder" u
       SET "status"      = 'IN_PROGRESS',
           "sentLastTime"= now_utc,
           "sentLastDay" = local_midnight_utc
      FROM cte
     WHERE u."id" = cte."id"
     RETURNING
       u."id"                         AS reminder_id,
       u."companyId"::text            AS company_id,
       qrec."id"                      AS queue_id,
       qrec."timezone"                AS timezone,
       qrec."template"::jsonb         AS message,
       u."clientPhone"                AS phone,
       u."clientName"                 AS client_name,
       qrec."callActions"             AS call_actions;
  END LOOP;
END;
$$;


/*
Aplicar resultado de red (después de fetch)
Guarda lastHttpCode, lastHttpResponse (texto), lastFailTimes/Time.
Si 2xx y el bot marcó receivedByBot = true, DONE y successCount++.
Si 2xx sin recibido, queda IN_PROGRESS.
Si error, status vuelve a PENDING para reintento.
*/
CREATE OR REPLACE FUNCTION public.apply_client_reminder_result(
  p_reminder_id uuid,
  p_http_code   int,
  p_http_body   text,
  p_received_by_bot boolean DEFAULT false,
  p_error_text  text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  q public."ClientReminderQueue";
  r public."ClientReminder";
BEGIN
  SELECT * INTO r FROM public."ClientReminder" WHERE id = p_reminder_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO q FROM public."ClientReminderQueue" WHERE id = r."clientReminderQueueId";

  UPDATE public."ClientReminder"
     SET "lastHttpCode"     = p_http_code,
         "lastHttpResponse" = COALESCE(p_http_body, p_error_text),
         "lastFailTimes"    = CASE
                                WHEN p_http_code BETWEEN 200 AND 299 THEN "lastFailTimes"  -- no suma
                                ELSE "lastFailTimes" + 1
                              END,
         "lastFailTime"     = CASE
                                WHEN p_http_code BETWEEN 200 AND 299 THEN "lastFailTime"
                                ELSE now()
                              END,
         "receivedByBot"    = COALESCE("receivedByBot", FALSE) OR COALESCE(p_received_by_bot, FALSE),
         "status"           = CASE
                                WHEN (p_http_code BETWEEN 200 AND 299) AND COALESCE(p_received_by_bot,false) THEN 'DONE'
                                WHEN (p_http_code BETWEEN 200 AND 299) THEN 'IN_PROGRESS'
                                ELSE 'PENDING'
                              END
   WHERE id = p_reminder_id;

  -- respeta tope maxCount: si alcanzó el límite, deja DONE
  IF q."maxCount" IS NOT NULL THEN
    UPDATE public."ClientReminder"
       SET "status" = 'DONE'
     WHERE id = p_reminder_id
       AND "successCount" >= q."maxCount";
  END IF;
END;
$$;

/*
Limpieza diaria & estado de queues (cron liviano)

Corre cada minuto: SELECT public.schedule_today_and_reset_once_crq();
(agenda la fila del día, resetea ONCE, recalcula estado).

Worker llama reserve_client_reminders(companyId, batch, retryMins) y hace fetch + apply_client_reminder_result.
*/


CREATE OR REPLACE FUNCTION public.refresh_client_reminder_queue(
  p_queue_id uuid,
  p_prune_old boolean DEFAULT true,           -- borrar agendas del mismo queue que no sean hoy
  p_reset_once boolean DEFAULT true,          -- aplicar reset ONCE (recibido, http, fails, status=PENDING si aplica)
  p_sync_stop_reminders boolean DEFAULT false -- recalcular stopReminders desde opt-out (costoso en colas gigantes)
)
RETURNS TABLE (
  scheduled_today boolean,
  reset_count     integer,
  new_status      "ReminderQueueStatus",
  today_text      text
)
LANGUAGE plpgsql
AS $$
DECLARE
  q     public."ClientReminderQueue";
  v_now timestamptz := now();
  v_today text;
  v_status "ReminderQueueStatus";
  v_inserted boolean := false;
  v_reset int := 0;
BEGIN
  -- 1) cargar queue
  SELECT * INTO q FROM public."ClientReminderQueue" WHERE id = p_queue_id;
  IF NOT FOUND THEN
    scheduled_today := false;
    reset_count := 0;
    new_status := NULL;
    today_text := NULL;
    RETURN;
  END IF;

  -- 2) día actual en timezone de la queue (formato "YYYY-MM-DD")
  v_today := to_char((v_now AT TIME ZONE q.timezone)::date, 'YYYY-MM-DD');

  -- 3) estado actual conforme a reglas
  v_status := public._client_queue_status_now(q);

  -- 4) si COMPLETED o inactiva, dejar estado y limpiar agenda de hoy (si existe)
  IF v_status = 'COMPLETED' OR q.active = FALSE THEN
    UPDATE public."ClientReminderQueue"
       SET "status" = v_status,
           "lastTimeChecked" = v_now
     WHERE id = q.id;

    IF p_prune_old THEN
      DELETE FROM public."ScheduledClientReminderQueues"
       WHERE "clientReminderQueueId" = q.id;  -- no conservamos agendas para queues cerradas
    END IF;

    scheduled_today := false;
    reset_count := 0;
    new_status := v_status;
    today_text := v_today;
    RETURN;
  END IF;

  -- 5) si hoy aplica por frecuencia/rango -> upsert agenda de HOY
  IF public._client_queue_matches_today(q) THEN
    INSERT INTO public."ScheduledClientReminderQueues"("clientReminderQueueId", day)
    VALUES (q.id, v_today)
    ON CONFLICT ("clientReminderQueueId","day") DO NOTHING;
    v_inserted := true;
  END IF;

  -- 6) opcional: prune agendas que NO sean hoy (performance/claridad)
  IF p_prune_old THEN
    DELETE FROM public."ScheduledClientReminderQueues"
     WHERE "clientReminderQueueId" = q.id
       AND day <> v_today;
  END IF;

  -- 7) reset ONCE (solo si se agendó hoy o ya existía agenda de hoy)
  IF p_reset_once THEN
    PERFORM 1 FROM public."ScheduledClientReminderQueues"
     WHERE "clientReminderQueueId" = q.id AND day = v_today;
    IF FOUND THEN
      v_reset := public.reset_once_for_client_reminder_queue(q.id);
    END IF;
  END IF;

  -- 8) opcional: resync stopReminders según opt-out (si cambia medium/timezone etc.)
  IF p_sync_stop_reminders THEN
    -- poner TRUE donde exista opt-out REMINDERS en el medium de la queue
    UPDATE public."ClientReminder" r
       SET "stopReminders" = TRUE
     WHERE r."clientReminderQueueId" = q.id
       AND r."stopReminders" = FALSE
       AND EXISTS (
         SELECT 1
         FROM public."ReminderNotificationOptOut" o
         WHERE o.phone = public._norm_phone(r."clientPhone")
           AND o."optOutType" = 'REMINDERS'
           AND o."optOutMedium" = q."targetMedium"
       );

    -- (opcional) volver a FALSE donde ya no exista opt-out
    UPDATE public."ClientReminder" r
       SET "stopReminders" = FALSE
     WHERE r."clientReminderQueueId" = q.id
       AND r."stopReminders" = TRUE
       AND NOT EXISTS (
         SELECT 1
         FROM public."ReminderNotificationOptOut" o
         WHERE o.phone = public._norm_phone(r."clientPhone")
           AND o."optOutType" = 'REMINDERS'
           AND o."optOutMedium" = q."targetMedium"
       );
  END IF;

  -- 9) guardar estado y timestamp de chequeo
  UPDATE public."ClientReminderQueue"
     SET "status" = v_status,
         "lastTimeChecked" = v_now
   WHERE id = q.id;

  -- 10) retornar resultados
  scheduled_today := v_inserted OR EXISTS (
    SELECT 1 FROM public."ScheduledClientReminderQueues"
     WHERE "clientReminderQueueId" = q.id AND day = v_today
  );
  reset_count := v_reset;
  new_status := v_status;
  today_text := v_today;
  RETURN;
END;
$$;


