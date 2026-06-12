import socket
import uvicorn
from uvicorn.protocols.http.h11_impl import H11Protocol


class NoDelayH11Protocol(H11Protocol):
    def connection_made(self, transport):
        sock = transport.get_extra_info("socket")
        if sock is not None:
            try:
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            except OSError:
                pass
        super().connection_made(transport)


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8080,
        http=NoDelayH11Protocol,
        workers=4,
    )
