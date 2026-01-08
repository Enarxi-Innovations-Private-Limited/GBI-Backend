import { IsString } from 'class-validator';

export class CreateDeviceto {
  @IsString()
  deviceId: string;
}
