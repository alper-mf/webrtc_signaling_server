import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway(443, {
  path: '/',
  serveClient: false,
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
export class KWebSocketGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private users: { name: string; conn: Socket }[] = [];

  afterInit() {
    console.log('WebSocket server initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.server.to(client.id).emit('connection', {
      message: 'Successfully connected to server',
    });
    this.handleDisconnect(client);
  }

  handleDisconnect(client: Socket) {
    client.on('disconnect', () => {
      console.log(`Client disconnected: ${client.id}`);
      const index = this.users.findIndex((user) => user.conn.id === client.id);
      if (index !== -1) {
        this.users.splice(index, 1);
      }
    });
  }

  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: string): string {
    const data = JSON.parse(payload);
    console.log('Received message:', data);

    const user = this.findUser(data.name);

    switch (data.type) {
      case 'store_user':
        if (user !== undefined) {
          console.log(`user ${data.name} already exists`);

          this.server.send('store_user', {
            message: 'username is taken, please select other',
          });

          return;
        }

        const newUser = {
          name: data.name,
          conn: client,
        };
        this.users.push(newUser);
        console.log('user added successfully');
        this.server.emit('store_user', { success: true });

        break;

      case 'start_call':
        const userToCall = this.findUser(data.target);

        if (userToCall) {
          console.log('sending offer to', userToCall.name);
          client.to(userToCall.conn.id).emit('incoming_call', {
            from: data.name,
          });
        } else {
          console.log('user to call not found');
          this.server.emit('call_failed', {
            message: 'user to call not found',
          });
        }
        break;

      case 'create_offer':
        const userToReceiveOffer = this.findUser(data.target);

        if (userToReceiveOffer) {
          userToReceiveOffer.conn.emit(
            JSON.stringify({
              type: 'offer_received',
              name: data.name,
              data: data.data.sdp,
            }),
          );
        }
        break;

      case 'create_answer':
        const userToReceiveAnswer = this.findUser(data.target);
        if (userToReceiveAnswer) {
          userToReceiveAnswer.conn.emit(
            JSON.stringify({
              type: 'answer_received',
              name: data.name,
              data: data.data.sdp,
            }),
          );
        }
        break;

      case 'ice_candidate':
        const userToReceiveIceCandidate = this.findUser(data.target);
        if (userToReceiveIceCandidate) {
          userToReceiveIceCandidate.conn.emit(
            JSON.stringify({
              type: 'ice_candidate',
              name: data.name,
              data: {
                sdpMLineIndex: data.data.sdpMLineIndex,
                sdpMid: data.data.sdpMid,
                sdpCandidate: data.data.sdpCandidate,
              },
            }),
          );
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
        client.emit('error', { message: 'Unknown message type' });
        break;
    }
    return 'Hello world!';
  }

  private findUser(username: string) {
    return this.users.find((user) => user.name === username);
  }
}
