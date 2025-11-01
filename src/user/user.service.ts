import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client'; // ✅ Enums from Prisma

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // ----------------------------------------
  // Create user (default: USER role, PENDING status)
  // ----------------------------------------
  async create(data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    status?: UserStatus;
  }) {
    const { name, email, password, role, status } = data;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password,
        role: role || UserRole.USER,
        status: status || UserStatus.PENDING,
      },
    });

    return { message: 'User created successfully', user };
  }

  // ----------------------------------------
  // Get all users
  // ----------------------------------------
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ----------------------------------------
  // Find single user by ID
  // ----------------------------------------
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ----------------------------------------
  // Update user details
  // ----------------------------------------
  async update(
    id: number,
    data: {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      status?: UserStatus;
    },
  ) {
    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.password)
      updateData.password = await bcrypt.hash(data.password, 10);
    if (data.role) updateData.role = data.role;
    if (data.status) updateData.status = data.status;

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return { message: 'User updated successfully', user };
  }

  // ----------------------------------------
  // Delete user
  // ----------------------------------------
  async remove(id: number) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  // ----------------------------------------
  // Login (simple password verification)
  // ----------------------------------------
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid email or password');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new BadRequestException('Invalid email or password');

    return { message: 'Login successful', user };
  }

  // ----------------------------------------
  // Find by email
  // ----------------------------------------
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // ----------------------------------------
  // Admin: Get all pending users for approval
  // ----------------------------------------
  async findPendingApprovals() {
    return this.prisma.user.findMany({
      where: { status: UserStatus.PENDING },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ----------------------------------------
  // Admin: Approve user
  // ----------------------------------------
  async approveUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (user.status === UserStatus.APPROVED)
      throw new BadRequestException('User is already approved');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.APPROVED },
    });

    return { message: 'User approved successfully', user: updated };
  }

  // ----------------------------------------
  // Admin: Reject user
  // ----------------------------------------
  async rejectUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (user.status === UserStatus.REJECTED)
      throw new BadRequestException('User is already rejected');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.REJECTED },
    });

    return { message: 'User rejected successfully', user: updated };
  }
}
