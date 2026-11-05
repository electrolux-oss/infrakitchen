from pathlib import Path
from fastmcp import FastMCP
from fastmcp.resources import TextResource
from pydantic import AnyUrl


def register_docs(mcp: FastMCP, docs_dir: Path) -> None:
    """Register documentation as MCP resources and tools."""
    docs_dir = docs_dir.resolve()
    docs_content: dict[str, str] = {}

    for path in docs_dir.rglob("*.md"):
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8").strip()
        if not content:
            continue

        rel_path = path.relative_to(docs_dir).as_posix()
        docs_content[rel_path] = content

        mcp.add_resource(
            TextResource(
                uri=AnyUrl(f"docs://{rel_path}"),
                name=rel_path,
                text=content,
                description=f"Documentation: {rel_path}",
                mime_type="text/markdown",
                tags={"documentation"},
            )
        )

    @mcp.tool()
    def list_docs(query: str | None = None) -> list[str]:
        """List available documentation files, optionally filtered by filename."""
        files = list(docs_content.keys())
        if query:
            files = [f for f in files if query.lower() in f.lower()]
        return sorted(files)

    @mcp.tool()
    def read_doc(path: str) -> str:
        """Read a documentation file's content."""
        if path not in docs_content:
            raise ValueError(f"Documentation not found: {path}")
        return docs_content[path]
