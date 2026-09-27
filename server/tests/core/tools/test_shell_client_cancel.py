import asyncio

import core.tools.shell_client as shell_client_mod


async def test_cancelling_stream_terminates_child_process(monkeypatch):
    started: list[asyncio.subprocess.Process] = []
    create = asyncio.create_subprocess_exec

    async def tracking_create(*args, **kwargs):
        process = await create(*args, **kwargs)
        started.append(process)
        return process

    monkeypatch.setattr(shell_client_mod.asyncio, "create_subprocess_exec", tracking_create)

    task = asyncio.create_task(shell_client_mod._stream_subprocess(["sleep", "30"], lambda _: None, lambda _: None))
    while not started:
        await asyncio.sleep(0.01)

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert started[0].returncode is not None, "child process must not outlive a cancelled task"
