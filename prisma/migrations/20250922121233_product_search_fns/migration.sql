-- 1) Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Funciones helper (lenguaje/regconfig/normalización)
CREATE OR REPLACE FUNCTION public._lang_to_regconfig(lang_code text)
RETURNS regconfig
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lang_code ILIKE 'es%' THEN 'spanish'::regconfig
    WHEN lang_code ILIKE 'en%' THEN 'english'::regconfig
    WHEN lang_code ILIKE 'pt%' THEN 'portuguese'::regconfig
    ELSE 'simple'::regconfig
  END;
$$;

CREATE OR REPLACE FUNCTION public.unaccent_immutable(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT unaccent('unaccent'::regdictionary, txt)
$$;

CREATE OR REPLACE FUNCTION public._normalize_query(q text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(coalesce(q,''), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public._build_prefix_tsquery(q text, cfg regconfig)
RETURNS tsquery
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  norm  text := public._normalize_query(q);
  parts text[];
  tok   text;
  expr  text := '';
  first boolean := true;
BEGIN
  IF norm IS NULL OR norm = '' THEN
    RETURN NULL;
  END IF;

  parts := regexp_split_to_array(norm, '\s+');

  FOREACH tok IN ARRAY parts LOOP
    tok := regexp_replace(tok, '[^[:alnum:]_]+', '', 'g');
    IF length(tok) = 0 THEN CONTINUE; END IF;

    IF NOT first THEN expr := expr || ' & '; END IF;
    expr := expr || quote_literal(tok) || ':*';
    first := false;
  END LOOP;

  IF expr = '' THEN
    RETURN NULL;
  END IF;

  RETURN to_tsquery(cfg, expr);
END;
$fn$;

-- 3) Columna FTS: asegurar que sea "normal" (no GENERATED) y exista
DO $$
BEGIN
  -- Si era GENERATED, convertirla a columna normal (evita drift de Prisma)
  BEGIN
    EXECUTE 'ALTER TABLE "ProductCatalog" ALTER COLUMN "search_vector" DROP EXPRESSION';
  EXCEPTION WHEN undefined_column THEN
    -- no existía la columna, seguimos
    NULL;
  WHEN feature_not_supported THEN
    -- en PG < 13 no existe DROP EXPRESSION; ignorar si no aplica
    NULL;
  END;

  -- Crear la columna si falta
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ProductCatalog'
      AND column_name  = 'search_vector'
  ) THEN
    EXECUTE 'ALTER TABLE "ProductCatalog" ADD COLUMN "search_vector" tsvector';
  END IF;
END $$;

-- 4) Trigger para mantener actualizado search_vector (INSERT/UPDATE)
CREATE OR REPLACE FUNCTION public._productcatalog_update_search_vector_tg()
RETURNS trigger
LANGUAGE plpgsql
AS $tg$
BEGIN
  NEW."search_vector" :=
    to_tsvector(
      public._lang_to_regconfig(coalesce(NEW."langCode",'simple')),
      public.unaccent_immutable(
        coalesce(NEW."id",'') || ' ' ||
        coalesce(NEW."industry",'') || ' ' ||
        coalesce(NEW."productService",'') || ' ' ||
        coalesce(NEW."type",'') || ' ' ||
        coalesce(NEW."subcategory",'') || ' ' ||
        coalesce(NEW."description",'') || ' ' ||
        coalesce(NEW."link",'') || ' ' ||
        coalesce(NEW."sourceFileName",'')
      )
    );
  RETURN NEW;
END;
$tg$;

DROP TRIGGER IF EXISTS tg_productcatalog_search_vector ON "ProductCatalog";
CREATE TRIGGER tg_productcatalog_search_vector
BEFORE INSERT OR UPDATE ON "ProductCatalog"
FOR EACH ROW
EXECUTE FUNCTION public._productcatalog_update_search_vector_tg();

-- 5) Índices FTS/TRGM (los BTREE los define Prisma vía @@index en schema.prisma)
CREATE INDEX IF NOT EXISTS idx_productcatalog_search_vector
  ON "ProductCatalog" USING GIN ("search_vector");

CREATE INDEX IF NOT EXISTS idx_pc_trgm_productservice
  ON "ProductCatalog" USING GIN ("productService" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pc_trgm_type
  ON "ProductCatalog" USING GIN ("type" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pc_trgm_subcategory
  ON "ProductCatalog" USING GIN ("subcategory" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pc_trgm_industry
  ON "ProductCatalog" USING GIN ("industry" gin_trgm_ops);

-- 6) Función de búsqueda (prefix + websearch + trgm fallback)
CREATE OR REPLACE FUNCTION public.search_product_catalog(
  p_company_id        text,
  p_query             text DEFAULT NULL,
  p_limit             integer DEFAULT 20,
  p_offset            integer DEFAULT 0,
  p_only_visible      boolean DEFAULT true,
  p_min_price         decimal(10,2) DEFAULT NULL,
  p_max_price         decimal(10,2) DEFAULT NULL,
  p_type              text DEFAULT NULL,
  p_subcategory       text DEFAULT NULL,
  p_payment_options   "PaymentOption"[] DEFAULT NULL
)
RETURNS TABLE (
  id                 text,
  industry           text,
  "productService"   text,
  "type"             text,
  subcategory        text,
  "listPrice"        decimal(10,2),
  "paymentOptions"   "PaymentOption"[],
  description        text,
  "companyId"        text,
  "createdBy"        text,
  "updatedBy"        text,
  link               text,
  "sourceFileName"   text,
  "sourceRowNumber"  integer,
  "langCode"         text,
  "bulkRequestId"    text,
  "isVisible"        boolean,
  metadata           jsonb,
  "createdAt"        timestamp(3),
  "updatedAt"        timestamp(3),
  rank               real,
  total_count        bigint
)
LANGUAGE sql
AS $$
WITH
params AS (
  SELECT public.unaccent_immutable(public._normalize_query(p_query)) AS q_norm
),
base AS (
  SELECT
    p.*,
    CASE
      WHEN (SELECT q_norm FROM params) = '' THEN NULL
      ELSE ts_rank_cd(
        p.search_vector,
        COALESCE(
          websearch_to_tsquery(
            public._lang_to_regconfig(coalesce(p."langCode",'simple')),
            (SELECT q_norm FROM params)
          ),
          public._build_prefix_tsquery(
            (SELECT q_norm FROM params),
            public._lang_to_regconfig(coalesce(p."langCode",'simple'))
          )
        )
      )
    END AS rank
  FROM "ProductCatalog" p
  WHERE p."companyId" = p_company_id
    AND (p."isVisible" = p_only_visible)
    AND (p_min_price IS NULL OR p."listPrice" >= p_min_price)
    AND (p_max_price IS NULL OR p."listPrice" <= p_max_price)
    AND (p_type IS NULL OR p."type" ILIKE p_type)
    AND (p_subcategory IS NULL OR p."subcategory" ILIKE p_subcategory)
    AND (
      (SELECT q_norm FROM params) = '' OR
      p.search_vector @@ websearch_to_tsquery(
        public._lang_to_regconfig(coalesce(p."langCode",'simple')),
        (SELECT q_norm FROM params)
      )
      OR p.search_vector @@ public._build_prefix_tsquery(
        (SELECT q_norm FROM params),
        public._lang_to_regconfig(coalesce(p."langCode",'simple'))
      )
      OR p."industry"       ILIKE '%' || (SELECT q_norm FROM params) || '%'
      OR p."productService" ILIKE '%' || (SELECT q_norm FROM params) || '%'
      OR p."type"           ILIKE '%' || (SELECT q_norm FROM params) || '%'
      OR p."subcategory"    ILIKE '%' || (SELECT q_norm FROM params) || '%'
    )
    AND (p_payment_options IS NULL OR p."paymentOptions" && p_payment_options)
),
counted AS (
  SELECT b.*, count(*) OVER() AS total_count
  FROM base b
)
SELECT
  c."id", c."industry", c."productService", c."type", c."subcategory",
  c."listPrice", c."paymentOptions", c."description", c."companyId",
  c."createdBy", c."updatedBy", c."link", c."sourceFileName",
  c."sourceRowNumber", c."langCode", c."bulkRequestId", c."isVisible",
  c."metadata", c."createdAt", c."updatedAt",
  coalesce(c.rank, 0) AS rank,
  c.total_count
FROM counted c
ORDER BY
  CASE WHEN (SELECT q_norm FROM params) = '' THEN 1 ELSE 0 END,
  c.rank DESC NULLS LAST,
  c."createdAt" DESC
LIMIT coalesce(p_limit, 2147483647)
OFFSET greatest(coalesce(p_offset, 0), 0);
$$;
