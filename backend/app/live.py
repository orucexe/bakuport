import asyncio

import anyio
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder


class LiveHub:
    def __init__(self):
        self.clients: set[asyncio.Queue] = set()

    async def publish(self, event_type: str, data) -> None:
        event = jsonable_encoder({"type": event_type, "data": data})
        for queue in list(self.clients):
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(event)

    async def connect(self, socket: WebSocket) -> None:
        await socket.accept()
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.clients.add(queue)

        async def send():
            while True:
                await socket.send_json(await queue.get())

        try:
            async with anyio.create_task_group() as group:
                group.start_soon(send)
                try:
                    while True:
                        await socket.receive_text()
                except WebSocketDisconnect:
                    pass
                finally:
                    group.cancel_scope.cancel()
        finally:
            self.clients.discard(queue)
