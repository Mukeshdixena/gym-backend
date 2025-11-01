import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';

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

    // Create user with status PENDING
    const created = await this.userService.create({
      name: data.name,
      email: data.email,
      password: hashed,
      // 🟢 Only if your UserService.create accepts 'status' argument
      // otherwise handle it in service itself (see below)
    });

    const user = created.user; // since create() returns { message, user }

    return {
      message: 'User registered successfully. Awaiting admin approval.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    };
  }

  // ---------------------------------------
  // Login — only for APPROVED users
  // ---------------------------------------
  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'APPROVED') {
      throw new UnauthorizedException('Account not approved by admin yet');
    }

    const token = this.jwtService.sign({ userId: user.id });
    return {
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async validateUser(payload: { userId: number }) {
    return this.userService.findOne(payload.userId);
  }
}
