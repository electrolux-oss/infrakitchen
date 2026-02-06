import pytest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastmcp import FastMCP

from infrakitchen_mcp.docs_tools import register_docs


class TestRegisterDocs:
    """Test that docs are accessible via MCP."""

    @pytest.fixture
    def server_with_docs(self):
        """Server with test docs registered."""
        server = FastMCP("TestServer")
        with TemporaryDirectory() as tmpdir:
            docs_path = Path(tmpdir)
            (docs_path / "guide.md").write_text("# Guide\n\nContent here.")
            (docs_path / "empty.md").write_text("")  # Should be skipped
            (docs_path / "notes.txt").write_text("Not markdown")  # Should be skipped

            subdir = docs_path / "nested"
            subdir.mkdir()
            (subdir / "deep.md").write_text("# Deep\n\nNested content.")

            register_docs(server, docs_path)
            yield server

    @pytest.mark.asyncio
    async def test_markdown_files_become_resources(self, server_with_docs):
        """Non-empty .md files should be registered as resources."""
        resources = await server_with_docs.list_resources()

        names = [r.name for r in resources]
        assert "guide.md" in names
        assert "nested/deep.md" in names
        # Empty and non-md should be excluded
        assert "empty.md" not in names
        assert "notes.txt" not in names

    @pytest.mark.asyncio
    async def test_tools_are_registered(self, server_with_docs):
        """list_docs and read_doc tools should exist."""
        tools = await server_with_docs.list_tools()
        tool_names = [t.name for t in tools]

        assert "list_docs" in tool_names
        assert "read_doc" in tool_names

    @pytest.mark.asyncio
    async def test_can_list_and_read_docs(self, server_with_docs):
        """Core flow: list docs, then read one."""
        # List should return available docs
        list_result = await server_with_docs.call_tool("list_docs", {})
        assert "guide.md" in list_result.content[0].text

        # Read should return content
        read_result = await server_with_docs.call_tool("read_doc", {"path": "guide.md"})
        assert "Content here" in read_result.content[0].text

    def test_empty_dir_doesnt_crash(self):
        """Empty docs directory should work without errors."""
        server = FastMCP("TestServer")
        with TemporaryDirectory() as tmpdir:
            register_docs(server, Path(tmpdir))
            # No exception = success
