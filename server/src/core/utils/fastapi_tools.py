import json
from typing import Any

from fastapi import Query


QueryParamsType = tuple[dict[str, Any] | None, tuple[int, int] | None, tuple[str, str] | None, list[str] | None]


def parse_query_params(
    filter: str = Query(None),
    range: str = Query(None),
    sort: str = Query(None),
    fields: str = Query(None),
) -> QueryParamsType:
    try:
        parsed_filter = json.loads(filter) if filter else None
        parsed_range = tuple(json.loads(range)) if range else None
        parsed_sort = tuple(json.loads(sort)) if sort else None
        parsed_fields = json.loads(fields) if fields else None
        return parsed_filter, parsed_range, parsed_sort, parsed_fields
    except json.JSONDecodeError as e:
        raise ValueError("Invalid query parameter format") from e
