import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    let status = HttpStatus.FORBIDDEN;
    let statusText: string;
    if ((exception instanceof HttpException)) {
      statusText = exception.message || "operation failed !";
      status = exception.getStatus();
    } else {
      statusText = exception.toString();
    }
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
      statusText = "Session Token Expired, login and try again";
    }
    /*response.statusMessage = message;
    response.status(status);
    response.send(message);*/
    /*response.writeHead(status, message, { "content-type": "text/plain", "statusText": message });
    response.end(message);*/
    response
      .status(status)
      .json({
        status,
        statusText,
        timestamp: new Date().toISOString(),
        path: request.url
      });
  }
}