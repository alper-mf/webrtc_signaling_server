import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KWebSocketGateway } from './websocket/websocket.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, KWebSocketGateway],
})
export class AppModule {}
