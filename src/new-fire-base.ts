import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { environment } from "./lib/environments/environment";
import { add, isEqual } from "date-fns";
import { FirestoreQuery, RippleUtils } from "./lib";
import { FireBase } from "./firebase";
import { gcloudConfig } from "./gcloud-key";

export const ENV = environment;
export const FIREBASE_CONFIG = ENV.firebase;
admin.initializeApp({
  databaseURL: FIREBASE_CONFIG.databaseURL,
  credential: admin.credential.cert(gcloudConfig()),
  storageBucket: FIREBASE_CONFIG.storageBucket
});

/* tslint:enable */
export class NewFireBase {
  private static instance: NewFireBase;

  private constructor() {
  }

  public static getInstance(): NewFireBase {
    if (!NewFireBase.instance) {
      NewFireBase.instance = new NewFireBase();
    }
    return NewFireBase.instance;
  }

  db = (): FirebaseFirestore.Firestore => admin.firestore();

  auth = () => admin.auth();

  functions = (region = environment.region) => functions.region(region);
  throwAppCheckError = () => {
    console.error("failed-precondition: The function must be called from an App Check verified app.");
    return this.error("Server access denied, App not recognized by server");
  };

  onCall = (functionCall: any) => functionCall;

  log = (message: any) => {
    console.log(message);
    functions.logger.log(message);
  };

  error = (reason: string, value: any = null) => {
    functions.logger.error(reason);
    const error = new (functions.https.HttpsError)("not-found", reason);
    console.log(reason);
    return this.respond({ message: error.message, value }, false);
  };
  getDatabases = () => this.db().collection("databases");
  getCollection = (path: string, databaseId = this.getDatabaseName()) => {
    // console.log('databaseId: ' + databaseId);
    const dbId = databaseId ? databaseId : this.getDatabaseName();
    return this.db().collection("databases").doc(dbId).collection(path);
  };
  getQueryReference = (parentRef: any, set?: Set<FirestoreQuery>): FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData> => {
    let ref = parentRef;
    if (set && set.size > 0) {
      set.forEach((entry) => {
        ref = ref.where(entry.key, entry.operator, entry.value);
      });
    }
    return ref;
  };
  respond = (data: any, sanitize = true) => {
    return new Promise<any>((resolve) => resolve(sanitize ? RippleUtils.sanitizeObject(data) : data));
  };

  transferData = (fromDatabase: string, toDatabase: string, collectionsToTransfer: string[] = []) => {
    if (collectionsToTransfer.length > 0) {
      collectionsToTransfer.forEach((colName) => {
        this.db().collection("databases").doc(fromDatabase).collection(colName).get().then((documents) => {
          let total = 0;
          documents.forEach((document) => {
            this.db().collection("databases").doc(toDatabase).collection(colName).doc(document.id).set(document.data()).then((result) => {
              total++;
            });
          });
          console.log(`imported ${total} records from ${colName} from(${fromDatabase}) to (${toDatabase})!`);
        });
      });
    } else {
      // import everything
      this.db().collection("databases").doc(fromDatabase).onSnapshot((snap) => {
        if (snap.exists) {
          const oldData: any = snap.data();
          if (oldData) {
            this.db().collection("databases").doc(toDatabase).set(oldData).then((result) => {
              console.log(`importing data from(${fromDatabase}) to (${toDatabase}) succeeded !`);
              console.log(result);
            });
          } else {
            console.log(`importing data from(${fromDatabase}) to (${toDatabase}) failed, old data is empty !`);
          }
        } else {
          console.log(`importing data from(${fromDatabase}) to (${toDatabase}) failed, old data does not exist !`);
        }
      });
    }
  };
  getEntitiesByDateRange = (query: any,
                            startingDate: any = null,
                            endingDate: any = null,
                            dateInclusive = true,
                            dateFieldName = "date") => {
    let queryFn = query;
    try {
      let startDate: Date | null;
      const startDateIsString = typeof startingDate === "string";
      if (startDateIsString) {
        startDate = (startingDate.length > 0) ? RippleUtils.fireDate(startingDate) : null; // check for empty string
      } else {
        startDate = startingDate;
      }
      let endDate: any;
      const endDateIsString = typeof endingDate === "string";
      if (endDateIsString) {
        endDate = (endingDate.length > 0) ? RippleUtils.fireDate(endingDate) : null; // check for empty string
      } else {
        endDate = endingDate;
      }
      const gteOperator = dateInclusive ? ">=" : ">";
      const lteOperator = dateInclusive ? "<=" : "<";
      const SD = RippleUtils.getShortDate(startDate || new Date());
      let ED = RippleUtils.getShortDate(endDate);
      if (startDate && endDate) {
        if (isEqual(startDate, endDate)) {
          // offset end date so that firebase doesn't throw an error
          // order by clause cannot contain a field with an equality filter startDate
          ED = RippleUtils.getShortDate(add(endDate, { seconds: 30 }));
        }
        queryFn = queryFn.where(dateFieldName, gteOperator, SD)
          .where(dateFieldName, lteOperator, ED);
      } else if (startDate && !endDate) {
        queryFn = queryFn.where(dateFieldName, gteOperator, SD);
      } else if (endDate && !startDate) {
        queryFn = queryFn.where(dateFieldName, lteOperator, ED);
      }
    } catch (e) {
      console.error(e);
    }
    return queryFn;
  };

  docRef(collectionName: string) {
    return FireBase.functions().firestore.document(`databases/${this.getDatabaseName()}/${collectionName}/{docId}`);
  }

  schedule(duration: string, region = environment.region) {
    return FireBase.functions(region).pubsub.schedule(duration);
  }

  private getDatabaseName = (): string => {
    return ENV.databaseName;
    // return appFunctionRegistry.get(AppRoutes.api_db_key) || ENV.databaseName;
  };
}
