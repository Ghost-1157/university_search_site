import os
import re
from collections import OrderedDict

import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    'host': 'localhost',
    'database': 'practice_for_practice',
    'user': 'postgres',
    'password': '25101989ad',
    'port': 5432,
}

SOURCE_TABLE = os.environ.get('SOURCE_TABLE', 'university_db_new')
TARGET_TABLE = os.environ.get('TARGET_TABLE', 'university_table_final')


def get_conn():
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(**DB_CONFIG)


def fetch_column_meta(conn, table_name):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name, data_type, ordinal_position
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position
            """,
            (table_name,),
        )
        return cur.fetchall()


def fetch_columns(conn, table_name):
    return [row[0] for row in fetch_column_meta(conn, table_name)]


def fetch_types(conn, table_name):
    return {row[0]: row[1] for row in fetch_column_meta(conn, table_name)}


def add_missing_columns(conn, source_cols, target_cols):
    missing = [col for col in source_cols if col not in target_cols]
    if not missing:
        return []

    with conn.cursor() as cur:
        for col in missing:
            cur.execute(f'ALTER TABLE "{TARGET_TABLE}" ADD COLUMN "{col}" TEXT')
    conn.commit()
    return missing


def detect_key_columns(cols):
    name_candidates = [col for col in cols if re.search(r'univer|name|^col$', col, re.I)]
    program_candidates = [col for col in cols if re.search(r'program|specialty|direction|major|col_7|col_8|code', col, re.I)]

    uni_col = name_candidates[0] if name_candidates else cols[0]
    prog_col = program_candidates[0] if program_candidates else (cols[7] if len(cols) > 7 else cols[0])
    return uni_col, prog_col


def coerce_value(value, data_type):
    if value is None:
        return None

    text = str(value).strip()
    if text == '':
        return None

    data_type = (data_type or 'text').lower()
    if data_type in ('bigint', 'integer', 'smallint'):
        cleaned = re.sub(r'[^0-9\-]+', '', text)
        if cleaned in ('', '-'):
            return None
        try:
            return int(cleaned)
        except ValueError:
            return None

    if data_type in ('double precision', 'numeric', 'real'):
        cleaned = re.sub(r'[^0-9\.\-]+', '', text)
        if cleaned in ('', '-', '.', '-.'):
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None

    return value


def merge_tables(conn):
    source_cols = fetch_columns(conn, SOURCE_TABLE)
    target_cols = fetch_columns(conn, TARGET_TABLE)
    target_types = fetch_types(conn, TARGET_TABLE)

    missing_cols = add_missing_columns(conn, source_cols, target_cols)
    if missing_cols:
        target_cols = fetch_columns(conn, TARGET_TABLE)
        target_types = fetch_types(conn, TARGET_TABLE)

    uni_col, prog_col = detect_key_columns(source_cols)

    before_target = count_rows(conn, TARGET_TABLE)
    source_rows = fetch_source_rows(conn, source_cols)

    inserted = 0
    with conn.cursor() as cur:
        for row in source_rows:
            row_map = OrderedDict(zip(source_cols, row))
            uni_val = row_map.get(uni_col)
            prog_val = row_map.get(prog_col)

            cur.execute(
                f'''SELECT 1
                    FROM "{TARGET_TABLE}"
                    WHERE COALESCE(NULLIF("{uni_col}", ''), '') = COALESCE(NULLIF(%s, ''), '')
                      AND COALESCE(NULLIF("{prog_col}", ''), '') = COALESCE(NULLIF(%s, ''), '')
                    LIMIT 1''',
                (uni_val, prog_val),
            )
            if cur.fetchone():
                continue

            insert_cols = []
            insert_vals = []
            placeholders = []
            for col in source_cols:
                insert_cols.append(f'"{col}"')
                insert_vals.append(coerce_value(row_map.get(col), target_types.get(col, 'text')))
                placeholders.append('%s')

            cur.execute(
                f'''INSERT INTO "{TARGET_TABLE}" ({', '.join(insert_cols)})
                    VALUES ({', '.join(placeholders)})''',
                insert_vals,
            )
            inserted += 1

    conn.commit()
    after_target = count_rows(conn, TARGET_TABLE)
    sample_row = fetch_sample_row(conn)

    return {
        'source_cols': source_cols,
        'target_cols': target_cols,
        'missing_cols': missing_cols,
        'uni_col': uni_col,
        'prog_col': prog_col,
        'before_target': before_target,
        'after_target': after_target,
        'inserted': inserted,
        'sample_row': sample_row,
    }


def fetch_source_rows(conn, source_cols):
    with conn.cursor() as cur:
        cur.execute(f'SELECT * FROM "{SOURCE_TABLE}"')
        return cur.fetchall()


def count_rows(conn, table_name):
    with conn.cursor() as cur:
        cur.execute(f'SELECT COUNT(*)::int FROM "{table_name}"')
        return cur.fetchone()[0]


def fetch_sample_row(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'SELECT * FROM "{TARGET_TABLE}" ORDER BY id NULLS LAST LIMIT 1')
        row = cur.fetchone()
        return dict(row) if row else None


def main():
    conn = get_conn()
    try:
        result = merge_tables(conn)
        print(f"source_cols={len(result['source_cols'])}")
        print(f"target_cols={len(result['target_cols'])}")
        print(f"missing_cols={result['missing_cols']}")
        print(f"key_columns=({result['uni_col']}, {result['prog_col']})")
        print(f"before_target={result['before_target']}")
        print(f"inserted={result['inserted']}")
        print(f"after_target={result['after_target']}")
        print(f"sample_row={result['sample_row']}")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
