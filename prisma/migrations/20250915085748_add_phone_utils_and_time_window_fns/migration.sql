-- Normalizador de teléfonos: deja dígitos y +, o NULL si queda vacío
CREATE OR REPLACE FUNCTION public._norm_phone(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT NULLIF(regexp_replace(coalesce($1,''), '[^0-9+]', '', 'g'), '');
$$;


-- ¿now_utc::time está dentro de [start,end] en UTC? maneja ventana que cruza medianoche
CREATE OR REPLACE FUNCTION public._time_in_window(p_start text, p_end text, p_now timestamptz, p_timezone text default 'UTC')
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_t time := to_char((p_now AT TIME ZONE p_timezone)::time, 'HH24:MI:SS')::time;
    v_s time := to_char(p_start::time, 'HH24:MI:SS')::time;
    v_e time := to_char(p_end::time, 'HH24:MI:SS')::time;
BEGIN
    IF v_s <= v_e THEN
        RETURN v_t >= v_s AND v_t <= v_e;
    ELSE
        -- Cruce de medianoche (ej: 22:00 -> 04:00)
        RETURN (v_t >= v_s) OR (v_t <= v_e);
    END IF;
END;
$$;


-- DOW code 'SU','MO',... para una fecha
CREATE OR REPLACE FUNCTION public._dow_code(p_d timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT (ARRAY['SU','MO','TU','WE','TH','FR','SA'])[extract(dow FROM p_d)::int + 1];
$$;


