import { Injectable } from '@nestjs/common';
import { User } from 'generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  updateProfile(userId: string, data: Partial<User>) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  markEmailAsVerified(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  markPhoneAsVerified(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    });
  }
}
