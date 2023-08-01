import { FireBase } from "../firebase";
import { AppRoutes, FirestoreQuery, LogLevel, RippleUtils, UserLog } from "../lib";

const userLogDb = FireBase.getCollection(AppRoutes.logs.api.INDEX);

export class SysLog {
    static fromFn(funcName: string): string {
        return ''; // appFunctionLogRegistry.get(funcName) || funcName;
    }

    static toFn(funcName: string, message: string): void {
        // appFunctionLogRegistry.set(funcName, message);
    }

    static log(uid = '', message: string, email = ''): void {
        SysLog.saveLog(new UserLog(uid, message, email, LogLevel.INFO));
    }

    static warn(uid = '', message: string, email = ''): void {
        SysLog.saveLog(new UserLog(uid, message, email, LogLevel.WARN));
    }

    static error(uid = '', message: string, email = ''): void {
        SysLog.saveLog(new UserLog(uid, message, email, LogLevel.ERROR));
    }

    static deleteLogByOptions = (options: any) => {
        return new Promise<boolean>((resolve, reject) => {
            return SysLog.getUserLogByOptions(options).then((logs) => {
                return SysLog.deleteLog(logs)
                    .then(() => resolve(true))
                    .catch((reason) => reject(reason));
            }).catch((err: any) => {
                return reject(err);
            });
        });
    };
    static deleteLog = (logs: UserLog[]) => {
        if (logs.length === 0) {
            return Promise.resolve(false);
        }
        let batch = userLogDb.firestore.batch();
        logs.forEach((log) => {
            if (log.getId()) {
                batch = batch.delete(userLogDb.doc(log.getId()));
            }
        });
        return batch.commit().then((result) => result.length === logs.length).catch((error) => {
            FireBase.log(error);
            return false;
        });
    };

    /*you have to build indexes for all these query params and all possible
combinations of them, otherwise the query will throw an error in firebase*/
    static getUserLogByOptions(options: any) {
        // you need to build indexes for this query, look at the firebase.indexes.json file for details
        return new Promise<UserLog[]>((resolve, reject) => {
            let queryFn = userLogDb.orderBy('created', 'desc');
            const set = new Set<FirestoreQuery>();
            if (options.email !== undefined) {
                set.add({key: 'email', operator: '==', value: options.email});
            }
            if (options.uid !== undefined) {
                set.add({key: 'uid', operator: '==', value: options.uid});
            }
            if (options.modifiedBy !== undefined) {
                set.add({key: 'modifiedBy', operator: '==', value: options.modifiedBy});
            }
            if (options.date !== undefined) {
                const operator = options.dateOperator || '==';
                set.add({key: 'created', operator, value: RippleUtils.getShortDate(options.date)});
            }
            queryFn = FireBase.getQueryReference(queryFn, set);
            if (options.startDate && options.endDate) {
                queryFn = FireBase.getEntitiesByDateRange(queryFn,
                    options.startDate,
                    options.endDate,
                    true, 'created');
            }
            return queryFn.get().then((snap) => {
                if (snap.empty) {
                    return resolve([]);
                }
                const results: UserLog[] = snap.docs.map((doc) => {
                    const userLog = new UserLog().toObject(doc.data());
                    userLog.setId(doc.id);
                    return (userLog);
                });
                return resolve(results);
            }).catch((reason) => reject(reason));
        });
    }

    /*this is a void function and any errors are logged to the console for admin consumption only*/
    private static saveLog = (userLog: UserLog): void => {
        try {
            const notLoggedIn = !RippleUtils.stringIsSet(userLog.getUid());
            // const noEmail = !RippleUtils.stringIsSet(userLog.getEmail());
            // take either email or uid or both
            if (notLoggedIn) {
                return;
            }
            if (userLog.getId()) {
                userLogDb.doc(userLog.getId()).set(RippleUtils.sanitizeObject(userLog))
                    .then(() => console.log('log was modified'))
                    .catch((error) => console.log(error));
            } else {
                userLogDb.add(RippleUtils.sanitizeObject(userLog))
                    .then(() => console.log('new log was created'))
                    .catch((error) => console.log(error));
            }
        } catch (e) {
            console.log(e);
        }
    };
}
