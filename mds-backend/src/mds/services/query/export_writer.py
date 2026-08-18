from __future__ import annotations

import csv
from collections.abc import Iterable
from pathlib import Path

XLSX_MAX_DATA_ROWS = 1_048_575


def export_row_cap(format: str, csv_max_limit: int, override: bool) -> int | None:
    if format == "xlsx":
        return XLSX_MAX_DATA_ROWS
    if override:
        return None
    return csv_max_limit


def write_csv(path: str | Path, headers: list[str], rows: Iterable[list[str]]) -> int:
    count = 0
    with open(path, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


def write_xlsx(path: str | Path, headers: list[str], rows: Iterable[list[str]]) -> int:
    import xlsxwriter

    count = 0
    workbook = xlsxwriter.Workbook(str(path), {"constant_memory": True})
    try:
        worksheet = workbook.add_worksheet()
        worksheet.write_row(0, 0, headers)
        for row_index, row in enumerate(rows, start=1):
            worksheet.write_row(row_index, 0, row)
            count += 1
    finally:
        workbook.close()
    return count
