import { Controller, Get, Query } from "@nestjs/common";
import { AppUtils } from "../lib";
import { EmailsService } from "./emails.service";

@Controller("emails")
export class EmailsController {
  constructor(private readonly service: EmailsService) {
  }

  @Get("was-emailed")
  wasEmailed(@Query() query: any) {
    return new Promise<any>((resolve, reject) => {
      const email = query.email;
      const referenceNo = query.referenceNo || "";
      if (!AppUtils.stringIsSet(email)) {
        return reject("Please set email and try again");
      }
      return this.service.wasEmailed(email, referenceNo)
        .then((ok) => resolve(ok))
        .catch((reason) => reject(reason));
    });
  }
}
