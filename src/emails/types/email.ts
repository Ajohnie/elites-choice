import * as nodemailer from "nodemailer";
import { EmailMessage } from "./email-message";
import { EmailTemplate } from "./email-template";

export interface Email {
  id?: string;
  to: string,
  reference: any,
  referenceNo?: any,
  sent?: boolean,
  info?: nodemailer.SentMessageInfo,
  lastModified?: any,
  template: { // modified here and made it compulsory 00:23 18-May-2022 mugja enterprises api
    name: EmailTemplate, //must match id of document in templates collection
    data: any,
  },
  message?: EmailMessage,
}