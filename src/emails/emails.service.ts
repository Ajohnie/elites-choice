import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as handleBars from "handlebars";
import * as nodemailer from "nodemailer";
import * as smtpTransport from "nodemailer-smtp-transport";
import * as path from "path";
import { Email, EmailTemplate, TemplateDoc } from "./types";
import { FireBase } from "../firebase";
import { AppConstants, AppUtils } from "../lib";
import { Attachment, Options } from "nodemailer/lib/mailer";
import { PdfService } from "./pdf.service";
import { environment } from "../lib/environments/environment";

const MAIL_COLLECTION_SING = "email";
const MAIL_COLLECTION = `${MAIL_COLLECTION_SING}s`;
const TEMPLATE_COLLECTION = "email-templates";
const EMAIL_SERVICE = "gmail";
const EMAIL_HOST_SSL = "eripplesolutions.com";
const EMAIL_HOST_NON_SSL = "mail.eripplesolutions.com";
const USE_SSL = true;
const USER_EMAIL = "ripplesolutions2014@gmail.com";
const USER_PASSWORD = "dwznbyldifwnctbd";
const COMPANY = environment.ownerInfo.uraUserName;
const FROM = `${COMPANY} <${USER_EMAIL}>`;
const PASSWORD_SUBJECT = `CREDENTIALS FOR ${COMPANY}`;

@Injectable()
export class EmailsService {
  private templateDb = FireBase.getCollection(TEMPLATE_COLLECTION);
  private emailDb = FireBase.getCollection(MAIL_COLLECTION);

  constructor(private pdf: PdfService) {
  }

  sendOtp(username: string,
          email: string,
          otp: string,
          expire: string) {
    return new Promise<boolean>((resolve, reject) => {
      console.log(`sending otp to ${email}`);
      return this.getEmail(email,
        "OTP",
        username,
        { otp, expire },
        EmailTemplate.OTP,
        `OTP FOR ${COMPANY}`).then((email) => {
        return this.processEmails(email).then(() => resolve(true)).catch((reason) => reject(reason));
      }).catch((reason) => reject(reason));
    });
  }

  sendOrder(username: string,
            supermarketName: string,
            title: string,
            email: string,
            head: string[][],
            body: string[][]) {
    return new Promise<boolean>((resolve, reject) => {
      console.log(`sending order to ${email}`);
      return this.getEmail(email,
        "ORDER",
        username,
        { supermarketName },
        EmailTemplate.ORDER,
        `ORDER FROM ${COMPANY}`).then(async (email) => {
        try {
          const pdfBuffer = await this.pdf.exportPdf(title, head, body);
          const attachments = [
            {
              filename: `${title}.pdf`,
              content: Buffer.from(pdfBuffer)
            }
          ];
          return this.processEmails(email, attachments).then(() => resolve(true)).catch((reason) => reject(reason));
        } catch (e) {
          return reject(e);
        }
      }).catch((reason) => reject(reason));
    });
  }

  sendPurchaseQuote(
    referenceNo: string,
    username: string,
    title: string,
    email: string,
    data: any[]) {
    return new Promise<boolean>((resolve, reject) => {
      console.log(`sending quote to ${email}`);
      return this.getEmail(email,
        "QUOTATION",
        username,
        {},
        EmailTemplate.PURCHASE_QUOTATION,
        `QUOTATION FROM ${COMPANY}`, referenceNo).then(async (email) => {
        try {
          const pdfBuffer = await this.pdf.exportPdfMultiple(title, data);
          const attachments = [
            {
              filename: `${title}.pdf`,
              content: Buffer.from(pdfBuffer)
            }
          ];
          return this.processEmails(email, attachments)
            .then(() => resolve(true))
            .catch((reason) => reject(reason));
        } catch (e) {
          return reject(e);
        }
      }).catch((reason) => reject(reason));
    });
  }

  sendPurchaseOrder(
    referenceNo: string,
    username: string,
    title: string,
    email: string,
    data: any[]) {
    return new Promise<boolean>((resolve, reject) => {
      console.log(`sending order to ${email}`);
      return this.getEmail(email,
        "LPO",
        username,
        {},
        EmailTemplate.PURCHASE_ORDER,
        `LPO FROM ${COMPANY}`,
        referenceNo).then(async (email) => {
        try {
          const pdfBuffer = await this.pdf.exportPdfMultiple(title, data);
          const attachments = [
            {
              filename: `${title}.pdf`,
              content: Buffer.from(pdfBuffer)
            }
          ];
          return this.processEmails(email, attachments)
            .then(() => resolve(true))
            .catch((reason) => reject(reason));
        } catch (e) {
          return reject(e);
        }
      }).catch((reason) => reject(reason));
    });
  }

  sendPurchaseReceipt(
    referenceNo: string,
    username: string,
    title: string,
    email: string,
    data: any[]) {
    return new Promise<boolean>((resolve, reject) => {
      console.log(`sending order to ${email}`);
      return this.getEmail(email,
        "GRN",
        username,
        {},
        EmailTemplate.PURCHASE_RECEIPT,
        `GRN FROM ${COMPANY}`, referenceNo).then(async (email) => {
        try {
          const pdfBuffer = await this.pdf.exportPdfMultiple(title, data);
          const attachments = [
            {
              filename: `${title}.pdf`,
              content: Buffer.from(pdfBuffer)
            }
          ];
          return this.processEmails(email, attachments)
            .then(() => resolve(true))
            .catch((reason) => reject(reason));
        } catch (e) {
          return reject(e);
        }
      }).catch((reason) => reject(reason));
    });
  }

  sendPassword(username: string, email: string, password: string) {
    return new Promise<boolean>((resolve, reject) => {
      return this.getEmail(email,
        "PASSWORD",
        username,
        { password },
        EmailTemplate.PASSWORD,
        PASSWORD_SUBJECT).then((email) => {
        return this.processEmails(email).then(() => resolve(true)).catch((reason) => reject(reason));
      }).catch((reason) => reject(reason));
    });
  }

// const getDateFormat = (date: any) => AppUtils.fireDate(date).toDateString();
  saveEmailTemplateDoc(name: EmailTemplate, template: { subject: string, html: string }) {
    return new Promise<boolean>((resolve, reject) => {
      return this.templateDb.doc(name).set(template)
        .then(() => resolve(true))
        .catch((reason) => reject(reason));
    });
  }

  /* put date formatting in one place, we can easily change format without doing many edits*/

  emailTemplateExists(templateName: EmailTemplate) {
    return new Promise<boolean>((resolve, reject) => {
      return this.templateDb.doc(templateName).get().then((data) => {
        if (!data.exists) {
          return resolve(false);
        }
        const template: any = data.data();
        const subjectIsNoSet = template.subject && template.subject === "";
        if (subjectIsNoSet) {
          return resolve(false);
        }
        const htmlIsNotSet = template.html && template.html === "";
        if (htmlIsNotSet) {
          return resolve(false);
        }
        return resolve(true);
      }).catch((reason) => reject(reason));
    });
  }

  createEmailTemplate(templateName: EmailTemplate, subject: string) {
    return new Promise<boolean>((resolve, reject) => {
      return this.emailTemplateExists(templateName).then((exists) => {
        if (exists) {
          return resolve(true);
        }
        console.log("creating email templates");
        return this.readTemplateFromFile(templateName).then((html) => {
          return this.saveEmailTemplateDoc(templateName, { subject, html }).then(() => {
            console.log("creating email templates succeeded");
            return resolve(true);
          }).catch((error) => {
            console.error(error);
            return reject(`creating email template for ${templateName} failed`);
          });
        }).catch((error) => {
          console.error(error);
          return reject(`creating email template for ${templateName} failed`);
        });
      }).catch((error) => {
        console.error(error);
        return reject(`creating email template for ${templateName} failed`);
      });
    });
  }

  getEmail(
    email: string,
    reference: string,
    username: string,
    value: any,
    templateName: EmailTemplate,
    subject: string,
    referenceNo = "") {
    return new Promise<Email>((resolve, reject) => {
      const data = {
        username,
        ...value,
        currencyWords: AppConstants.CURRENCY_WORDS,
        directorSign: environment.ownerInfo.directorSign,
        tin: environment.ownerInfo.tin
      };
      const config = {
        to: email,
        referenceNo,
        reference, // its important u set this as it will be helpful when searching for duplicates
        template: {
          name: templateName,
          data
        }
      };
      return this.createEmailTemplate(templateName, subject).then(() => resolve(config)).catch((reason) => reject(reason));
    });
  };

  readTemplateFromFile(name: EmailTemplate) {
    return new Promise<string>((resolve, reject) => {
      const filePath = path.join(__dirname, `/templates/${name}.html`);
      fs.readFile(filePath, "utf8", (error, htmlString) => {
        if (!error && htmlString) {
          return resolve(htmlString);
        } else {
          return reject(error);
        }
      });
    });
  }

  getHtmlFromTemplate(data: any, templateName: EmailTemplate) {
    return new Promise<TemplateDoc | null>((resolve, reject) => {
      if (typeof data !== "object") {
        console.error("\n----------error creating email template, data invalid--------\n");
        console.error(data);
        return reject("error creating email template, data invalid");
      }
      return this.templateDb.doc(templateName).get().then((doc) => {
        if (!doc.exists) {
          return reject(`email template ${templateName} does not exist`);
        }
        const email: TemplateDoc | any = doc.data();
        const template = handleBars.compile(email.html, { data: true });
        const html = template({ ...data, companyName: COMPANY });
        return resolve({ subject: email.subject, html });
      }).catch((error) => reject(error));
    });
  }

  getEmailTransport() {
    return nodemailer.createTransport(smtpTransport({
      service: EMAIL_SERVICE,
      secure: USE_SSL,
      requireTLS: USE_SSL,
      port: USE_SSL ? 465 : 587,
      auth: {
        user: USER_EMAIL,
        pass: USER_PASSWORD
      }
    }));
  }

  getEmailTransportAlt() {
    return nodemailer.createTransport(smtpTransport({
      secure: USE_SSL,
      requireTLS: USE_SSL,
      port: USE_SSL ? 465 : 587,
      host: USE_SSL ? EMAIL_HOST_SSL : EMAIL_HOST_NON_SSL,
      auth: {
        user: USER_EMAIL,
        pass: USER_PASSWORD
      }
    }));
  }

  wasEmailed(email: string, referenceNo?: string) {
    return new Promise<boolean>((resolve, reject) => {
      if (!AppUtils.stringIsSet(email)) {
        return reject("Please set email and try again");
      }
      return this.getMailByEmail(email, referenceNo)
        .then((data: any) => {
          if (!data) {
            return resolve(false);
          }
          return resolve(data.sent);
        }).catch((reason) => reject(reason));
    });
  }

  getMailByEmail = (to: string, referenceNo?: string) => {
    return new Promise<Email | null>((resolve, reject) => {
      if (!AppUtils.isEmail(to)) {
        return reject(`invalid email ${to}`);
      }
      const collection = this.emailDb;
      let finder = collection.where("to", "==", to);
      if (AppUtils.stringIsSet(referenceNo)) {
        finder = finder.where("referenceNo", "==", referenceNo);
      }
      // check existing
      return finder.limit(1).get().then((docs) => {
        if (docs.empty) {
          return resolve(null);
        }
        const doc = docs.docs[0];
        const mail: Email | any = doc.data();
        mail.id = doc.id;
        return resolve(mail);
      }).catch((error) => reject(error));
    });
  };

  private saveMail = (toSend: Email) => {
    return new Promise<string>((resolve, reject) => {
      const collection = this.emailDb;
      return this.getMailByEmail(toSend.to, toSend.referenceNo).then((mail: any) => {
        if (!mail) {
          return collection.add(toSend)
            .then(() => "email has been queued for processing")
            .catch((error) => reject(error));
        }
        let message = "email already queued";
        return collection.doc(mail.id).set(toSend)
          .then(() => resolve(message))
          .catch((error) => reject(error));
      }).catch((error) => reject(error));
    });
  };

  private processEmails(emailData: Email, attachments: Attachment[] = []) {
    return new Promise<boolean>((resolve, reject) => {
      const templateName = emailData.template.name;
      return this.getHtmlFromTemplate(emailData.template.data, templateName)
        .then((template) => {
          if (!template) {
            return reject(`template for ${templateName} not found or can not be generated`);
          }
          const mailOptions: Options = {
            from: FROM,
            to: emailData.to,
            subject: template.subject,
            html: template.html
          };
          if (attachments.length > 0) {
            mailOptions.attachments = attachments;
          }
          const transporter = this.getEmailTransport();
          return transporter.verify().then((canSend) => {
            if (canSend) {
              // returning result
              return transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                  return reject(error);
                }
                emailData.sent = true;
                emailData.lastModified = (new Date()).getTime();
                emailData.info = info;
                return this.saveMail(emailData).then(() => {
                  console.log(`sent email to ${emailData.to}`);
                  return resolve(true);
                }).catch((reason) => reject(reason));
              });
            }
            return reject("email transport can not send messages at this time");
          }).catch((reason) => reject(reason));
        }).catch((reason) => reject(reason));
    });
  }
}
