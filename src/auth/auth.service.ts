import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  // ✅ Register new user
  async register(data: { name: string; email: string; password: string }) {
    const user = await this.userService.create(data);
    const token = this.jwtService.sign({ userId: user.user.id });
    return { ...user, token };
  }

  // ✅ Login existing user
  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

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

  // ✅ Verify token payload (used by strategy)
  async validateUser(payload: { userId: number }) {
    return this.userService.findOne(payload.userId);
  }
}
