import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {
  }

  catch(exception: any, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    let status = HttpStatus.FORBIDDEN;
    let statusText: string;
    if ((exception instanceof HttpException)) {
      statusText = exception.message || "operation failed !";
      status = exception.getStatus();
    } else {
      statusText = exception.toString();
    }
    console.log(exception);
    const notFound = statusText.toLowerCase().includes("auth/user-not-found");
    const wrongCredentials = statusText.toLowerCase().includes("auth/wrong-password");
    const wrongPassword = statusText.toLowerCase().includes("password is invalid") || wrongCredentials;
    const wrongEmail = statusText.toLowerCase().includes("no user record") || statusText.toLowerCase().includes("auth/user-not-found");
    const noInternet = statusText.toLowerCase().includes("network-request-failed");
    const tokenExpired = statusText.toLowerCase().includes("auth/id-token-expired");
    //  no user record
    if (notFound) {
      statusText = "incorrect email or password";
    } else if (wrongPassword) {
      statusText = "password is invalid";
    } else if (wrongEmail) {
      statusText = "incorrect email or password";
    } else if (noInternet) {
      statusText = "connect to internet and try again";
    } else if (tokenExpired) {
      statusText = "Session token Expired, login and try again";
    }
    const responseBody = {
      status,
      statusText,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest())
    };
    httpAdapter.reply(ctx.getResponse(), responseBody, status);
  }
}
