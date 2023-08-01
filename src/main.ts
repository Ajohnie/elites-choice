import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ExpressAdapter } from "@nestjs/platform-express";
import { FireBase } from "./firebase";
import * as express from "express";
import { AuthGuard } from "./auth/auth.guard";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";
import * as compression from "compression";


const SERVER_PORT = 4048;
const HTTP_TIMEOUT = 300;
const MAX_MEMORY = "8GB";
const options: any = { memory: MAX_MEMORY, timeoutSeconds: HTTP_TIMEOUT };
/*async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(SERVER_PORT);
}

bootstrap().catch((reason) => console.error(reason));*/

const server: any = express();
// Create and init Nest server based on Express instance.
const bootstrap = async (expressInstance: any) => {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressInstance));
  // https://github.com/expressjs/cors#configuration-options
  app.enableCors({
    origin: [
      "http://localhost:5800",
      "http://localhost:5900",
      "https://elites-choice.web.app",
      "https://elites-choice-mobile.web.app"
    ],
    optionsSuccessStatus: 200,
    preflightContinue: false,
    credentials: true,
    allowedHeaders: ["Access-Control-Allow-Origin", "Content-Type", "Authorization", "X-Request-Timeout", "uid"]
  });
  app.useGlobalGuards(new AuthGuard());
  // app.useGlobalFilters(new HttpExceptionFilter());
  const host = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(host));
  app.use(compression());
  app.init().then((app) => {
    console.log(`started server successfully`);
    return app;
  }).catch((reason) => console.error(reason));
  // await app.listen(SERVER_PORT);
  // FireBase.log("started firebase successfully");
};

bootstrap(server).catch((reason) => console.error(reason));

export const api = FireBase.functions().runWith(options).https.onRequest(server);
