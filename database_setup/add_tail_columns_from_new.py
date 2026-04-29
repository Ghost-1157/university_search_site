import os
import re

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


def normalize(value):
    return re.sub(r'\s+', ' ', str(value or '').strip().lower())


def fetch_columns(conn, table_name):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position
            """,
            (table_name,),
        )
        return [row[0] for row in cur.fetchall()]


def ensure_columns(conn):
    target_columns = set(fetch_columns(conn, TARGET_TABLE))
    with conn.cursor() as cur:
        if 'col_22' not in target_columns:
            cur.execute(f'ALTER TABLE "{TARGET_TABLE}" ADD COLUMN "col_22" TEXT')
        if 'col_23' not in target_columns:
            cur.execute(f'ALTER TABLE "{TARGET_TABLE}" ADD COLUMN "col_23" TEXT')
    conn.commit()


def build_source_map(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'SELECT * FROM "{SOURCE_TABLE}"')
        rows = cur.fetchall()

    mapping = {}
    for row in rows:
        key = (normalize(row.get('col')), normalize(row.get('col_7')))
        if key not in mapping:
            mapping[key] = row
    return mapping


def backfill(conn):
    ensure_columns(conn)
    with conn.cursor() as cur:
        cur.execute(
            f'''
                UPDATE "{TARGET_TABLE}" AS t
                SET "col_22" = s."col_16",
                    "col_23" = s."col_17"
                FROM "{SOURCE_TABLE}" AS s
                WHERE t."col" = s."col"
                  AND lower(t."col_8") = lower(s."col_7")
            '''
        )
        updated = cur.rowcount

    conn.commit()
    with conn.cursor() as cur:
        cur.execute(f'SELECT COUNT(*) FROM "{TARGET_TABLE}"')
        target_count = cur.fetchone()[0]
        cur.execute(f'SELECT COUNT(*) FROM "{SOURCE_TABLE}"')
        source_count = cur.fetchone()[0]
    return updated, target_count, source_count


def main():
    conn = get_conn()
    try:
        updated, target_count, source_count = backfill(conn)
        print(f'updated={updated}')
        print(f'target_rows={target_count}')
        print(f'source_keys={source_count}')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
