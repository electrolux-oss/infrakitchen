import { InfraKitchenApi } from "../api/InfraKitchenApi";
export interface WebSocketEventHandler {
  (event: MessageEvent): void;
}

class WebSocketManager {
  private socket: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private eventHandler: WebSocketEventHandler | null = null;
  private readonly ikApi: InfraKitchenApi;

  constructor(ikApi: InfraKitchenApi, webSocketUrl: string, path: string) {
    this.ikApi = ikApi;
    this.url = `${webSocketUrl}${path}`;
  }

  public setEventHandler(handler: WebSocketEventHandler): void {
    this.eventHandler = handler;
  }

  public async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    this.clearReconnectTimeout();

    const token = await this.ikApi.getToken();
    if (!token) {
      this.scheduleReconnect(5000); // Retry connection after 5 seconds
      return;
    }

    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      if (this.socket) {
        this.socket.send(
          JSON.stringify({ type: "authenticate", token: token }),
        );
      }
    };

    this.socket.onmessage = (event: MessageEvent) => {
      if (this.eventHandler) {
        this.eventHandler(event);
      }
    };

    this.socket.onclose = (event: CloseEvent) => {
      if (event.code === 1006 || event.code === 1012 || event.code === 3008) {
        this.scheduleReconnect(5000); // Reconnect on abnormal or specific server closures
      }
    };

    this.socket.onerror = (_: Event) => {
      if (this.socket) {
        this.socket.close(4000, "Error occurred");
      }
    };
  }

  public disconnect(
    code: number = 1000,
    reason: string = "Normal Closure",
  ): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(code, reason);
    }
    this.clearReconnectTimeout();
  }

  private scheduleReconnect(delay: number): void {
    this.clearReconnectTimeout();
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      this.disconnect(1000, "User left tab");
    } else if (document.visibilityState === "visible") {
      this.connect();
    }
  };

  public startVisibilityTracking(): void {
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  public stopVisibilityTracking(): void {
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
  }
}

export default WebSocketManager;
