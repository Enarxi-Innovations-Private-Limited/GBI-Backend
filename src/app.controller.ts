import { Controller, Get} from '@nestjs/common';
import { AppService } from './app.service';
import { ServiceUnavailableException } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
  async getHealthReady(): Promise<object> {
    const result = await this.appService.getHealthReady();

    if (result.status !== 'ready') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
