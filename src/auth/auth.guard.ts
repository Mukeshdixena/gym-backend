import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // Add proper types
  handleRequest<T = any>(err: any, user: T, info: any): T {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
