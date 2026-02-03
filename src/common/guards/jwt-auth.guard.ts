import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const classRef = context.getClass();
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      handler,
      classRef,
    ]);

    if (isPublic) {
      return true;
    }
    const result = await super.canActivate(context);
    console.log('JWT Guard result:', result);
    return result as boolean;
  }
}
