import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type RequestUser = { sub: number; email: string; role: string};

export const AuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const req = ctx.switchToHttp().getRequest();
  console.log("User ======== ", req.user);
  
  return req.user as RequestUser;
});
