from infrakitchen_mcp.client import DocsProvider
from infrakitchen_mcp.server import DEFAULT_DOCS_DIR
import pytest


class TestDocsDirectoryStructure:
    """Verify the actual docs directory is properly set up."""

    def test_docs_directory_exists(self):
        """DEFAULT_DOCS_DIR should point to an existing directory."""
        assert DEFAULT_DOCS_DIR.exists(), f"Docs directory not found: {DEFAULT_DOCS_DIR}"
        assert DEFAULT_DOCS_DIR.is_dir(), f"Docs path is not a directory: {DEFAULT_DOCS_DIR}"

    def test_docs_contains_markdown_files(self, docs_provider: DocsProvider):
        """Docs directory should contain at least one markdown file."""
        files = docs_provider.list_files()
        assert len(files) > 0, f"No .md files found in {DEFAULT_DOCS_DIR}"

    def test_all_listed_files_are_readable(self, docs_provider: DocsProvider):
        """Every file returned by list_files should be readable."""
        files = docs_provider.list_files()
        for file_path in files:
            content = docs_provider.read_file(file_path)
            assert len(content) > 0, f"File is empty: {file_path}"


class TestDocsProviderSecurity:
    """Test path traversal and security measures."""

    def test_path_traversal_with_dotdot(self, temp_docs_provider: DocsProvider):
        """Should block ../ path traversal attempts."""
        with pytest.raises(ValueError, match="Access denied"):
            temp_docs_provider.read_file("../../../etc/passwd")

    def test_path_traversal_nested(self, temp_docs_provider: DocsProvider):
        """Should block traversal even from nested paths."""
        with pytest.raises(ValueError, match="Access denied"):
            temp_docs_provider.read_file("api/../../etc/passwd")

    def test_absolute_path_blocked(self, temp_docs_provider: DocsProvider):
        """Should not allow absolute paths outside base."""
        with pytest.raises((ValueError, FileNotFoundError)):
            temp_docs_provider.read_file("/etc/passwd")

    def test_nonexistent_file(self, temp_docs_provider: DocsProvider):
        """Should raise FileNotFoundError for missing files."""
        with pytest.raises(FileNotFoundError):
            temp_docs_provider.read_file("does-not-exist.md")


class TestDocsProviderFunctionality:
    """Test basic provider operations."""

    def test_list_files_returns_sorted(self, temp_docs_provider: DocsProvider):
        """Files should be returned in sorted order."""
        files = temp_docs_provider.list_files()
        assert files == sorted(files)

    def test_list_files_includes_nested(self, temp_docs_provider: DocsProvider):
        """Should find files in subdirectories."""
        files = temp_docs_provider.list_files()
        nested = [f for f in files if "/" in f]
        assert len(nested) > 0, "Should find nested files"

    def test_search_filters_by_query(self, temp_docs_provider: DocsProvider):
        """Query parameter should filter results."""
        all_files = temp_docs_provider.list_files()
        filtered = temp_docs_provider.list_files(query="README")

        assert len(filtered) < len(all_files)
        assert all("readme" in f.lower() for f in filtered)

    def test_search_is_case_insensitive(self, temp_docs_provider: DocsProvider):
        """Search should be case-insensitive."""
        upper = temp_docs_provider.list_files(query="README")
        lower = temp_docs_provider.list_files(query="readme")
        assert upper == lower
