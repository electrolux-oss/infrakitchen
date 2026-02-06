"""Tests for result compression transforms."""

import pytest
from unittest.mock import patch

from mcp.types import TextContent

from infrakitchen_mcp.transforms import (
    CompressResultsTransform,
    _compress_value,
    _compress_dict,
    _compress_results_fn,
)
from fastmcp.tools.tool import Tool, ToolResult


class TestCompression:
    """Test that compression actually compresses."""

    def test_primitives_not_compressed(self):
        """Primitives should pass through - they're already small."""
        for val in [None, "text", 42, 3.14, True]:
            assert _compress_value(val) == val

    def test_collections_become_smaller(self):
        """Lists and dicts should become smaller representations."""
        big_list = [{"nested": "data"} for _ in range(100)]
        big_dict = {f"key_{i}": {"nested": "data"} for i in range(100)}

        compressed_list = _compress_value(big_list)
        compressed_dict = _compress_value(big_dict)

        # Compressed form should be much smaller than original
        assert len(str(compressed_list)) < len(str(big_list)) / 10
        assert len(str(compressed_dict)) < len(str(big_dict)) / 10

    def test_compress_dict_preserves_top_level_keys(self):
        """Top-level keys should remain visible for LLM understanding."""
        entity = {
            "id": "123",
            "name": "test",
            "children": [{"id": "c1"}, {"id": "c2"}],
            "metadata": {"key": "value"},
        }
        result = _compress_dict(entity)

        assert set(result.keys()) == set(entity.keys())
        assert result["id"] == "123"
        assert result["name"] == "test"


class TestCompressResultsTransform:
    """Test the transform integration."""

    @pytest.mark.asyncio
    async def test_passthrough_when_no_structured_content(self):
        """Don't break results without structured_content."""
        original = ToolResult(
            content=[TextContent(type="text", text="plain")],
        )

        with patch("infrakitchen_mcp.transforms.forward_raw", return_value=original):
            result = await _compress_results_fn()

        assert result is original

    @pytest.mark.asyncio
    async def test_output_is_valid_tool_result(self):
        """Transform should produce valid ToolResult."""
        original = ToolResult(
            content=[TextContent(type="text", text="{}")],
            structured_content={"data": [{"id": "1", "children": [{}, {}, {}]}]},
        )

        with patch("infrakitchen_mcp.transforms.forward_raw", return_value=original):
            result = await _compress_results_fn()

        # Should be a valid ToolResult with both content and structured_content
        assert isinstance(result, ToolResult)
        assert result.content
        assert result.structured_content

    def test_wrapped_tool_has_modified_description(self):
        """Wrapped tools should indicate results are summarized."""
        # Use a real Tool instance instead of MagicMock
        tool = Tool(
            name="test_tool",
            description="Original description",
            parameters={"type": "object", "properties": {}},
        )

        transform = CompressResultsTransform()
        wrapped = transform._wrap_tool(tool)
        assert wrapped.description is not None
        assert "summarized" in wrapped.description.lower() or "get_entity" in wrapped.description
