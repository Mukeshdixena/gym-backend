import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client'; // ✅ import Prisma enums

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  // ---------------------------------------
  // Register — sets status = PENDING (not approved yet)
  // ---------------------------------------
  async register(data: { name: string; email: string; password: string }) {
    const existing = await this.userService.findByEmail(data.email);
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const hashed = await bcrypt.hash(data.password, 10);

    // ✅ get full result and extract user
    const result = await this.userService.create({
      name: data.name,
      email: data.email,
      password: hashed,
      role: UserRole.USER,
      status: UserStatus.PENDING,
    });

    const user = result.user; // ✅ fix type error

    return {
      message: 'User registered successfully. Awaiting admin approval.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        role: user.role,
      },
    };
  }

  // ---------------------------------------
  // Login — only APPROVED users can log in
  // ---------------------------------------
  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== UserStatus.APPROVED) {
      throw new UnauthorizedException(
        user.status === UserStatus.PENDING
          ? 'Account not approved by admin yet'
          : 'Account rejected by admin',
      );
    }

    const token = this.jwtService.sign({ userId: user.id, role: user.role });

    return {
      message: 'Login successful',
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

  async validateUser(payload: { userId: number }) {
    return this.userService.findOne(payload.userId);
  }
}
