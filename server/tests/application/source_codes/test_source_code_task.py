import pytest


class TestSourceCodeTask:
    @pytest.mark.asyncio
    async def test_start_pipeline_success(self, mocked_source_code_task, mock_stream_subprocess, mock_source_code_crud):
        await mocked_source_code_task.start_pipeline()
        assert mock_stream_subprocess.call_count == 5
        assert mock_source_code_crud.refresh.call_count == 2
