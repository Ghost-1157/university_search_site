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

    return text


def build_source_map(conn, source_cols, uni_col, prog_col):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'SELECT * FROM "{SOURCE_TABLE}"')
        rows = cur.fetchall()

    mapping = {}
    for r in rows:
        key = (str(r.get(uni_col) or '').strip().lower(), str(r.get(prog_col) or '').strip().lower())
        # prefer first non-empty entry
        if key not in mapping:
            mapping[key] = r
    return mapping


def detect_key_columns(cols):
    name_candidates = [col for col in cols if re.search(r'univer|name|^col$', col, re.I)]
    program_candidates = [col for col in cols if re.search(r'program|specialty|direction|major|col_7|col_8|code', col, re.I)]

    uni_col = name_candidates[0] if name_candidates else cols[0]
    prog_col = program_candidates[0] if program_candidates else (cols[7] if len(cols) > 7 else cols[0])
    return uni_col, prog_col


def run_backfill():
    conn = get_conn()
    try:
        source_cols = fetch_columns(conn, SOURCE_TABLE)
        target_cols = fetch_columns(conn, TARGET_TABLE)
        target_types = fetch_types(conn, TARGET_TABLE)

        uni_col, prog_col = detect_key_columns(source_cols)
        source_map = build_source_map(conn, source_cols, uni_col, prog_col)

        # find target rows that are missing col_16 or col_17
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SELECT id, * FROM "{TARGET_TABLE}" WHERE "col_16" IS NULL OR "col_17" IS NULL')
            targets = cur.fetchall()

        updated = 0
        with conn.cursor() as cur:
            for t in targets:
                key = (str(t.get(uni_col) or '').strip().lower(), str(t.get(prog_col) or '').strip().lower())
                src = source_map.get(key)
                if not src:
                    continue

                new_c16 = coerce_value(src.get('col_16'), target_types.get('col_16'))
                new_c17 = coerce_value(src.get('col_17'), target_types.get('col_17'))

                # if nothing to set, skip
                if new_c16 is None and new_c17 is None:
                    continue

                set_clauses = []
                params = []
                if new_c16 is not None:
                    set_clauses.append(f'"col_16" = %s')
                    params.append(new_c16)
                if new_c17 is not None:
                    set_clauses.append(f'"col_17" = %s')
                    params.append(new_c17)

                params.append(t['id'])
                cur.execute(f'UPDATE "{TARGET_TABLE}" SET {", ".join(set_clauses)} WHERE id = %s', params)
                updated += 1

        conn.commit()
        print(f'rows_updated={updated}')

    finally:
        conn.close()


if __name__ == '__main__':
    run_backfill()
