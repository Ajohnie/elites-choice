import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Observable } from "rxjs";
import { FireBase } from "../firebase";
import { AuthService } from "./auth.service";
import { AppUtils, HarsherUtils } from "../lib";

@Injectable()
export class AuthGuard extends AuthService implements CanActivate {
  constructor() {
    super();
  }

  // Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const req = context.switchToHttp().getRequest();
      // console.log(`${req.headers}`)
      // console.log('req.headers');
      // console.log(req.headers);
      const authHeader = req.headers.authorization;
      // console.log("authHeader: " + authHeader);
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reject("Unauthorized request");
      }
      const idToken = req.headers.authorization.split("Bearer ")[1];
      // console.log(idToken);
      // disabled checking revoked tokens because of The Firebase ID token has been revoked -->time out of sync
      return FireBase.auth().verifyIdToken(idToken, false).then((decodedIdToken) => {
        const res = context.switchToHttp().getResponse();
        res.setHeader("NEXT-TOKEN", decodedIdToken.exp);
        return this.setUserFromEmail(decodedIdToken.email || "").then(() => {
          return resolve(true);
        }).catch((reason) => reject(reason));
      }).catch((e) => {
        // auth/id-token-revoked
        const wasRevoked = e.toString().includes("revoked") || e.toString().includes("id-token-expired");
        if (wasRevoked) {
          /*if (1) {
            return resolve(true);
          }*/
          const uidHarsh = req.headers.uid;
          if (AppUtils.stringIsSet(uidHarsh)) {
            console.log("token expired or revoked, using uid header instead");
            const uid = HarsherUtils.decrypt(uidHarsh);
            return FireBase.auth().getUser(uid).then((user) => {
              return this.setUserFromEmail(user.email || "").then(() => {
                return resolve(true);
              }).catch((reason) => reject(reason));
            }).catch((reason) => reject(reason));
          }
          const path = req?.route?.path || "";
          if (path.toLowerCase().includes("logout")) {
            return resolve(true); // unconditionally allow logout
          }
          return reject("Authentication failed, Session Expired, Login and try again");
        } else {
          console.error("\n---------AUTH GUARD ERROR------------\n");
          console.error(e);
        }
        return reject("Unauthorized");
        // return reject("your session has expired, kindly login and try again");
      });
    });
  }
}
