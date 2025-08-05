-- =====================================================
-- SETUP DE PARTICIONADO PARA SISTEMA DE ANALYTICS
-- =====================================================

-- Función para crear particiones automáticamente
CREATE OR REPLACE FUNCTION create_partition_if_not_exists(
    table_name TEXT,
    partition_suffix TEXT,
    partition_column TEXT,
    start_date DATE,
    end_date DATE
) RETURNS void AS $$
DECLARE
    partition_table_name TEXT := table_name || '_' || partition_suffix;
    index_name TEXT;
BEGIN
    -- Verificar si la partición ya existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = partition_table_name
        AND schemaname = 'public'
    ) THEN
        -- Crear partición
        EXECUTE format('
            CREATE TABLE %I PARTITION OF %I
            FOR VALUES FROM (%L) TO (%L)
        ', partition_table_name, table_name, start_date, end_date);
        
        -- Crear índices específicos en la partición
        CASE table_name
            WHEN 'UniversalAuditLog' THEN
                -- Índices para UniversalAuditLog
                index_name := 'idx_' || partition_suffix || '_company_entity';
                EXECUTE format('
                    CREATE INDEX CONCURRENTLY %I 
                    ON %I (company_id, entity_type, change_type)
                ', index_name, partition_table_name);
                
                index_name := 'idx_' || partition_suffix || '_entity_id';
                EXECUTE format('
                    CREATE INDEX CONCURRENTLY %I 
                    ON %I (entity_type, entity_id, event_date_time)
                ', index_name, partition_table_name);
                
            WHEN 'KPIValue' THEN
                -- Índices para KPIValue
                index_name := 'idx_' || partition_suffix || '_kpi_company';
                EXECUTE format('
                    CREATE INDEX CONCURRENTLY %I 
                    ON %I (kpi_code, company_id, period_type)
                ', index_name, partition_table_name);
                
            WHEN 'SystemEvent' THEN
                -- Índices para SystemEvent
                index_name := 'idx_' || partition_suffix || '_event_company';
                EXECUTE format('
                    CREATE INDEX CONCURRENTLY %I 
                    ON %I (event_type, company_id, is_processed)
                ', index_name, partition_table_name);
        END CASE;
        
        RAISE NOTICE 'Created partition: %', partition_table_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Función genérica para crear particiones estratégicas
CREATE OR REPLACE FUNCTION create_strategic_partitions(
    table_name TEXT,
    partition_column TEXT DEFAULT 'event_date',
    partition_type TEXT DEFAULT 'MONTHLY',
    months_ahead INTEGER DEFAULT 24
) RETURNS void AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_suffix TEXT;
    i INTEGER;
BEGIN
    FOR i IN 0..months_ahead LOOP
        IF partition_type = 'MONTHLY' THEN
            start_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
            end_date := start_date + INTERVAL '1 month';
            partition_suffix := to_char(start_date, 'YYYY_MM');
        ELSIF partition_type = 'WEEKLY' THEN
            start_date := date_trunc('week', CURRENT_DATE) + (i || ' weeks')::INTERVAL;
            end_date := start_date + INTERVAL '1 week';
            partition_suffix := to_char(start_date, 'YYYY_WW');
        ELSIF partition_type = 'DAILY' THEN
            start_date := date_trunc('day', CURRENT_DATE) + (i || ' days')::INTERVAL;
            end_date := start_date + INTERVAL '1 day';
            partition_suffix := to_char(start_date, 'YYYY_MM_DD');
        END IF;
        
        -- Crear partición si no existe
        PERFORM create_partition_if_not_exists(
            table_name, 
            partition_suffix, 
            partition_column,
            start_date, 
            end_date
        );
    END LOOP;
    
    RAISE NOTICE 'Created % partitions for table %', months_ahead + 1, table_name;
END;
$$ LANGUAGE plpgsql;

-- Función para setup inicial de particionado
CREATE OR REPLACE FUNCTION setup_table_partitioning() RETURNS void AS $$
BEGIN
    -- Configurar particionado para UniversalAuditLog
    IF NOT EXISTS (
        SELECT 1 FROM pg_partitioned_table pt
        JOIN pg_class c ON pt.partrelid = c.oid
        WHERE c.relname = 'UniversalAuditLog'
    ) THEN
        -- Convertir tabla a particionada si no lo está
        RAISE NOTICE 'Table UniversalAuditLog is not partitioned. Manual conversion required.';
    END IF;
    
    -- Crear particiones para UniversalAuditLog (próximos 24 meses)
    PERFORM create_strategic_partitions('UniversalAuditLog', 'event_date', 'MONTHLY', 24);
    
    -- Crear particiones para KPIValue (próximos 12 meses) 
    PERFORM create_strategic_partitions('KPIValue', 'period_date', 'MONTHLY', 12);
    
    -- Crear particiones para SystemEvent (próximos 6 meses)
    PERFORM create_strategic_partitions('SystemEvent', 'event_date', 'MONTHLY', 6);
    
    RAISE NOTICE 'Partitioning setup completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Job automático para crear nuevas particiones cada mes
CREATE OR REPLACE FUNCTION create_monthly_partitions() RETURNS void AS $$
DECLARE
    next_month DATE := date_trunc('month', CURRENT_DATE + INTERVAL '2 months');
    tables_to_partition TEXT[] := ARRAY['UniversalAuditLog', 'KPIValue', 'SystemEvent'];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables_to_partition LOOP
        PERFORM create_strategic_partitions(table_name, 'event_date', 'MONTHLY', 1);
    END LOOP;
    
    RAISE NOTICE 'Monthly partition creation completed for: %', array_to_string(tables_to_partition, ', ');
END;
$$ LANGUAGE plpgsql;

-- Función para comprimir particiones antiguas
CREATE OR REPLACE FUNCTION compress_old_partitions(days_old INTEGER DEFAULT 90) RETURNS void AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE := CURRENT_DATE - (days_old || ' days')::INTERVAL;
BEGIN
    -- Buscar particiones antiguas para comprimir
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'UniversalAuditLog_%' 
           OR tablename LIKE 'KPIValue_%'
           OR tablename LIKE 'SystemEvent_%'
    LOOP
        -- En PostgreSQL 14+, se podría usar compresión nativa
        -- Por ahora solo registramos las particiones candidatas
        RAISE NOTICE 'Partition candidate for compression: %.%', 
                     partition_record.schemaname, partition_record.tablename;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función para eliminar particiones muy antiguas
CREATE OR REPLACE FUNCTION drop_old_partitions(retention_years INTEGER DEFAULT 5) RETURNS void AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE := CURRENT_DATE - (retention_years || ' years')::INTERVAL;
    partition_date DATE;
BEGIN
    -- Buscar particiones muy antiguas
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE (tablename LIKE 'UniversalAuditLog_%' 
            OR tablename LIKE 'KPIValue_%'
            OR tablename LIKE 'SystemEvent_%')
          AND tablename ~ '_[0-9]{4}_[0-9]{2}$'
    LOOP
        -- Extraer fecha de la partición del nombre
        BEGIN
            partition_date := to_date(
                regexp_replace(partition_record.tablename, '.*_([0-9]{4}_[0-9]{2})$', '\1'),
                'YYYY_MM'
            );
            
            IF partition_date < cutoff_date THEN
                -- Eliminar partición antigua
                EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', 
                              partition_record.schemaname, 
                              partition_record.tablename);
                              
                RAISE NOTICE 'Dropped old partition: %.%', 
                            partition_record.schemaname, partition_record.tablename;
            END IF;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE WARNING 'Could not process partition: %.%', 
                             partition_record.schemaname, partition_record.tablename;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función para estadísticas de particionado
CREATE OR REPLACE FUNCTION get_partition_statistics() RETURNS TABLE (
    table_name TEXT,
    partition_count BIGINT,
    total_size TEXT,
    avg_partition_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH partition_stats AS (
        SELECT 
            CASE 
                WHEN t.tablename LIKE 'UniversalAuditLog_%' THEN 'UniversalAuditLog'
                WHEN t.tablename LIKE 'KPIValue_%' THEN 'KPIValue' 
                WHEN t.tablename LIKE 'SystemEvent_%' THEN 'SystemEvent'
                ELSE 'Unknown'
            END as base_table,
            pg_total_relation_size(t.schemaname||'.'||t.tablename) as partition_size
        FROM pg_tables t
        WHERE t.tablename LIKE 'UniversalAuditLog_%' 
           OR t.tablename LIKE 'KPIValue_%'
           OR t.tablename LIKE 'SystemEvent_%'
    )
    SELECT 
        ps.base_table,
        COUNT(*)::BIGINT,
        pg_size_pretty(SUM(ps.partition_size)),
        pg_size_pretty(AVG(ps.partition_size)::BIGINT)
    FROM partition_stats ps
    WHERE ps.base_table != 'Unknown'
    GROUP BY ps.base_table
    ORDER BY ps.base_table;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar setup inicial
SELECT setup_table_partitioning();

-- Crear job programado usando pg_cron (si está disponible)
-- SELECT cron.schedule('create-monthly-partitions', '0 2 1 * *', 'SELECT create_monthly_partitions();');
-- SELECT cron.schedule('compress-old-partitions', '0 3 1 * *', 'SELECT compress_old_partitions(90);');

-- Configuraciones de performance para tablas particionadas
ALTER SYSTEM SET constraint_exclusion = partition;
ALTER SYSTEM SET enable_partition_pruning = on;
ALTER SYSTEM SET enable_partitionwise_join = on;
ALTER SYSTEM SET enable_partitionwise_aggregate = on;

-- Recargar configuración
SELECT pg_reload_conf();

-- Mostrar estadísticas iniciales
SELECT * FROM get_partition_statistics();

RAISE NOTICE 'Partitioning setup completed successfully! Use get_partition_statistics() to monitor.';