import { Module } from "@nestjs/common";
import { EmailsService } from "./emails.service";
import { PdfService } from "./pdf.service";
import { EmailsController } from "./emails.controller";

@Module({
  controllers: [EmailsController],
  providers: [EmailsService, PdfService],
  exports: [EmailsService]
})
export class EmailsModule {
}
