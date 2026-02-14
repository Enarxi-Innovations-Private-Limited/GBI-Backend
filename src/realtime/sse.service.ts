import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Subject } from 'rxjs';

/**
 * Service to manage Server-Sent Events (SSE) connections.
 * pushes real-time notifications to connected clients.
 */
@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private clients = new Map<string, Response[]>();

  /**
   * Add a new client connection for a specific user.
   * @param userId The ID of the authenticated user
   * @param res The Express Response object
   */
  addClient(userId: string, res: Response) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.push(res);
      this.logger.log(`Client connected: ${userId} (Total: ${userClients.length})`);
    }

    // Remove client on close
    res.on('close', () => {
      this.removeClient(userId, res);
    });
  }

  /**
   * Remove a client connection.
   */
  private removeClient(userId: string, res: Response) {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const index = userClients.indexOf(res);
    if (index !== -1) {
      userClients.splice(index, 1);
    }

    if (userClients.length === 0) {
      this.clients.delete(userId);
    }

    this.logger.log(`Client disconnected: ${userId}`);
  }

  /**
   * Send an event to a specific user.
   * @param userId The recipient User ID
   * @param data The data object to send
   */
  sendEvent(userId: string, data: any) {
    const recipients = this.clients.get(userId);
    if (!recipients || recipients.length === 0) return;

    const formattedData = `data: ${JSON.stringify(data)}\n\n`;

    recipients.forEach((client) => {
      client.write(formattedData);
    });
  }
}
