import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  // ✅ Get all users
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ Get user by ID
  async getUserById(id: number) {
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

  // ✅ Create user
  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    status?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new BadRequestException('Email already exists');

    const hashed = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: (data.role as UserRole) || UserRole.USER,
        status: (data.status as UserStatus) || UserStatus.APPROVED,
      },
    });
  }

  // ✅ Update user
  async updateUser(
    id: number,
    data: {
      name?: string;
      email?: string;
      role?: string;
      status?: string;
      password?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = { ...data };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    if (data.role) updateData.role = data.role as UserRole;
    if (data.status) updateData.status = data.status as UserStatus;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  // ✅ Delete user
  async deleteUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.delete({ where: { id } });
  }

  // ✅ Get all pending users
  async findPendingUsers() {
    return this.prisma.user.findMany({
      where: { status: UserStatus.PENDING },
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

  // ✅ Approve user
  async approveUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.APPROVED },
    });
  }

  // ✅ Reject user
  async rejectUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.REJECTED },
    });
  }

  // ✅ "Login as User" feature — Admin impersonates another user
  async impersonateUser(adminId: number, userId: number) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can perform this action');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.APPROVED) {
      throw new BadRequestException('User account is not approved');
    }

    // ✅ Generate token using your working AuthService
    const token = this.authService['jwtService'].sign({
      userId: user.id,
      role: user.role,
      impersonatedBy: admin.id,
    });

    return {
      message: `Admin ${admin.name} is now logged in as ${user.name}`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }
}
