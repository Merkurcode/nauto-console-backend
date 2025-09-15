-- Normaliza teléfono
CREATE OR REPLACE FUNCTION public._optout_norm_tg()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW."phone" := public._norm_phone(NEW."phone");
    RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS tg_optout_norm ON public."ReminderNotificationOptOut";
CREATE TRIGGER tg_optout_norm
BEFORE INSERT OR UPDATE ON public."ReminderNotificationOptOut"
FOR EACH ROW EXECUTE FUNCTION public._optout_norm_tg();


CREATE OR REPLACE FUNCTION public._optout_propagate_tg()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Marca stopReminders en cualquier ClientReminder con el mismo phone (normalizado)
    UPDATE public."ClientReminder" r
    SET "stopReminders" = true
    WHERE r."clientPhone" = NEW."phone" AND r."targetMedium" = NEW."optOutMedium" AND r."notifyType" = NEW."optOutType";
    RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS tg_optout_propagate ON public."ReminderNotificationOptOut";
CREATE TRIGGER tg_optout_propagate
AFTER INSERT ON public."ReminderNotificationOptOut"
FOR EACH ROW EXECUTE FUNCTION public._optout_propagate_tg();

CREATE OR REPLACE FUNCTION public._optout_del_propagate_tg()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Sólo quitar stopReminders si ya no hay NINGÚN optout para (phone, medium, type)
  IF NOT EXISTS (
    SELECT 1
    FROM public."ReminderNotificationOptOut" o
    WHERE o."phone"        = OLD."phone"
      AND o."optOutMedium" = OLD."optOutMedium"
      AND o."optOutType"   = OLD."optOutType"
  ) THEN
    UPDATE public."ClientReminder" r
       SET "stopReminders" = FALSE
     WHERE r."clientPhone"  = OLD."phone"
       AND r."targetMedium" = OLD."optOutMedium"
       AND r."notifyType"   = OLD."optOutType";
  END IF;
  
  RETURN OLD;
END;$$;
DROP TRIGGER IF EXISTS tg_optout_del_propagate ON public."ReminderNotificationOptOut";
CREATE TRIGGER tg_optout_del_propagate
AFTER DELETE ON public."ReminderNotificationOptOut"
FOR EACH ROW EXECUTE FUNCTION public._optout_del_propagate_tg();


-- normaliza phone y updatedAt
CREATE OR REPLACE FUNCTION public._trg_client_reminder_norm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW."clientPhone" := public._norm_phone(NEW."clientPhone");
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_client_reminder_norm ON public."ClientReminder";
CREATE TRIGGER trg_client_reminder_norm
BEFORE INSERT OR UPDATE ON public."ClientReminder"
FOR EACH ROW EXECUTE FUNCTION public._trg_client_reminder_norm();


-- status/successCount cuando cambia receivedByBot
CREATE OR REPLACE FUNCTION public._trg_client_reminder_status_on_received()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF COALESCE(OLD."receivedByBot",false) = false AND COALESCE(NEW."receivedByBot",false) = true THEN
            NEW.status := 'DONE';
            NEW."successCount" := GREATEST(0, OLD."successCount") + 1;
        ELSIF COALESCE(OLD."receivedByBot",false) = true AND COALESCE(NEW."receivedByBot",false) = false THEN
            NEW.status := 'FAILED';
            NEW."successCount" := GREATEST(0, OLD."successCount" - 1);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_client_reminder_status_on_received ON public."ClientReminder";
CREATE TRIGGER trg_client_reminder_status_on_received
BEFORE UPDATE ON public."ClientReminder"
FOR EACH ROW EXECUTE FUNCTION public._trg_client_reminder_status_on_received();

-------------------------------------------------------------------------------------------------------------------------


-- ¿Hoy (en TZ de la queue) coincide con frecuencia/intervalo/days?
CREATE OR REPLACE FUNCTION public._client_queue_matches_today(q public."ClientReminderQueue")
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  now_utc   timestamptz := now();
  now_tz    timestamptz := (now_utc AT TIME ZONE q.timezone);
  today     date := now_tz::date;

  start_d   date := (q."startDate" AT TIME ZONE q.timezone)::date;
  end_d     date := (q."endDate"   AT TIME ZONE q.timezone)::date;

  days_since bigint;
  week_idx   int;
  code       text;
  ok         boolean := false;
BEGIN
  IF today < start_d OR today > end_d THEN
    RETURN false;
  END IF;

  days_since := (today - start_d);

  CASE q.frequency
    WHEN 'DAILY' THEN
      ok := (days_since % q.interval = 0);

    WHEN 'WEEKLY' THEN
      week_idx := floor(days_since / 7);
      code := public._dow_code(today);
      ok := (week_idx % q.interval = 0)
            AND (cardinality(q.days)=0 OR code = ANY(q.days));

    WHEN 'MONTHLY' THEN
      ok := (
        (
          (date_part('year', today)*12 + date_part('month', today)) -
          (date_part('year', start_d)*12 + date_part('month', start_d))
        )::int % q.interval = 0
      );
      IF ok THEN
        ok := (
          date_part('day', today)::int =
          LEAST(date_part('day', start_d)::int,
                date_part('day', (date_trunc('month', today + interval '1 month') - interval '1 day'))::int)
        );
      END IF;

    WHEN 'YEARLY' THEN
      ok := (
        (date_part('year', today)::int - date_part('year', start_d)::int) % q.interval = 0
      ) AND (
        date_part('month', today)::int = date_part('month', start_d)::int
      ) AND (
        date_part('day', today)::int =
          LEAST(date_part('day', start_d)::int,
                date_part('day', (date_trunc('month', today + interval '1 month') - interval '1 day'))::int)
      );
  END CASE;

  IF q."stopUntil" IS NOT NULL AND now_tz >= (q."stopUntil" AT TIME ZONE q.timezone) THEN
    RETURN false;
  END IF;

  RETURN ok;
END;
$$;


-- Estado de queue ahora
CREATE OR REPLACE FUNCTION public._client_queue_status_now(q public."ClientReminderQueue")
RETURNS "ReminderQueueStatus" LANGUAGE plpgsql AS $$
BEGIN
  IF q.active = false THEN
    RETURN 'STANDBY';
  END IF;

  IF q."stopUntil" IS NOT NULL AND (now() AT TIME ZONE q.timezone) >= (q."stopUntil" AT TIME ZONE q.timezone) THEN
    RETURN 'COMPLETED';
  END IF;

  IF public._client_queue_matches_today(q) AND public._time_in_window(q."startHour", q."endHour", now(), q.timezone) THEN
    RETURN 'IN_PROGRESS';
  END IF;

  RETURN 'PENDING';
END;
$$;


