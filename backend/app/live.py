import asyncio

from fastapi import WebSocket
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

        async def receive():
            while True:
                await socket.receive_text()

        tasks = [asyncio.create_task(send()), asyncio.create_task(receive())]
        try:
            await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        finally:
            self.clients.discard(queue)
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
