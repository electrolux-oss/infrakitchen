#!/usr/bin/env python3

from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "server" / "src"))

from build_info import write_build_info  # noqa: E402


def main() -> int:
    output_file = write_build_info()
    print(f"Wrote {output_file.relative_to(REPO_ROOT)}")  # noqa: T201
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
