import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { PrismaService } from 'src/prisma/prisma.service';

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TelemetryGateway {
  constructor(private readonly prisma: PrismaService) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`✅ Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe_device')
  async subscribeDevice(
    @MessageBody() body: { deviceId: string },
    @ConnectedSocket() client: any,
  ) {
    const userId = client.user?.sub;
    const physicalDeviceId = body.deviceId;

    if (!userId) {
      return { success: false, message: 'Unauthorized' };
    }

    const device = await this.prisma.device.findUnique({
      where: { deviceId: physicalDeviceId },
      select: { id: true, deviceId: true },
    });

    if (!device) {
      return { success: false, message: 'Device not found' };
    }

    const assignment = await this.prisma.deviceAssignment.findFirst({
      where: {
        deviceId: device.id,
        userId: userId,
        unassignedAt: null,
      },
    });

    if (!assignment) {
      return { success: false, message: 'Access denied (not your device)' };
    }

    const room = `device:${body.deviceId}`;
    await client.join(room);
    return { success: true, room };
  }

  @SubscribeMessage('unsubscribe_device')
  async unsubscribeDevice(
    @MessageBody() body: { deviceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `device:${body.deviceId}`;
    await client.leave(room);
    return { success: true, room };
  }

  broadcastTelemetry(deviceId: string, payload: any) {
    this.server.to(`device:${deviceId}`).emit('telemetry_update', payload);
  }

  broadcastDeviceStatus(deviceId: string, status: string) {
    this.server.to(`device:${deviceId}`).emit('device_status', {
      deviceId,
      status,
    });
  }
}
