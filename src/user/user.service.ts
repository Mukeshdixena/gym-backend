import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // user.service.ts
  async create(data: {
    name: string;
    email: string;
    password: string;
    status?: string;
  }) {
    const { name, email, password, status } = data;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password,
        status: status || 'PENDING',
      },
    });

    return { message: 'User created successfully', user };
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(
    id: number,
    data: { name?: string; email?: string; password?: string },
  ) {
    const { name, email, password } = data;
    const updateData: any = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return { message: 'User updated successfully', user };
  }

  async remove(id: number) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid email or password');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new BadRequestException('Invalid email or password');

    return { message: 'Login successful', user };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
