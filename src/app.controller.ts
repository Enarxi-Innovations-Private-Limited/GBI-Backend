import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Get()
  getHello(): object {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth(): Promise<object> {
    return await this.appService.getHealth();
  }

  @Get('health/live')
  getHealthLive(): object {
    return this.appService.getHealthLive();
  }

  @Get('health/ready')
  async getHealthReady(@Res() res): Promise<void> {
    const result = await this.appService.getHealthReady();
    if (result.status === 'ready') {
      res.status(HttpStatus.OK).send(result);
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).send(result);
    }
  }
}
