import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@influencehub/database';

/** Consistent error envelope; never leaks stack traces or internal messages to clients. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { code: 'INTERNAL_ERROR', message: 'Something went wrong' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { code: r, message: r } : { code: (r as any).code ?? (r as any).error ?? 'ERROR', ...(r as object) };
      delete (body as any).statusCode;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { code: 'CONFLICT', message: 'Resource already exists' };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { code: 'NOT_FOUND', message: 'Resource not found' };
      } else this.logger.error(`${exception.code} ${exception.message}`);
    } else {
      this.logger.error(`${req.method} ${req.url}: ${(exception as Error)?.stack ?? exception}`);
    }
    res.status(status).json({ ...body, statusCode: status, path: req.url });
  }
}
