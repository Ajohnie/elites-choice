import { Module, OnModuleInit } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { EmailsModule } from "./emails/emails.module";
import { BranchesModule } from "./branches/branches.module";
import { LedgersModule } from "./ledgers/ledgers.module";
import { AccountsModule } from "./accounts/accounts.module";
import { AuthModule } from "./auth/auth.module";
import { EntriesModule } from "./entries/entries.module";
import { SharedModule } from "./shared/shared.module";

@Module({
  imports: [
    UsersModule,
    BranchesModule,
    EventEmitterModule.forRoot({
      // set this to `true` to use wildcards
      wildcard: false,
      // the delimiter used to segment namespaces
      delimiter: ".",
      // set this to `true` if you want to emit the newListener event
      newListener: false,
      // set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // the maximum amount of listeners that can be assigned to an event
      maxListeners: 10,
      // show event name in memory leak message when more than maximum amount of listeners is assigned
      verboseMemoryLeak: false,
      // disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false
    }),
    EmailsModule,
    AuthModule,
    SharedModule,
    AccountsModule,
    LedgersModule,
    EntriesModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements OnModuleInit {
  constructor() {
  }

  onModuleInit(): Promise<any> {
    return this.setUpAccounts();
  }


  setUpAccounts() {
    return new Promise<boolean>((resolve) => {
      console.log("accounting module initialised successfully");
      return resolve(true);
    });
  }
}
