export class Converter {
  static from(body: any, key?: string) {
    if (!body) {
      return body;
    }
    let params;
    if ((body instanceof ArrayBuffer) || (body instanceof Buffer)) {
      try {
        const json = Buffer.from(body).toString();
        params = JSON.parse(json);
        console.log("\nparams1\n");
        console.log(params);
      } catch (e) {
        params = Buffer.from(body).toString();
        console.log("\nparams2\n");
        console.log(params);
        // console.log("e L-14");
        // console.log(e);
      }
    } else {
      try {
        params = JSON.parse(body);
      } catch (e) {
        params = body;
        // console.log("e L-20");
        // console.log(e);
      }
    }
    let result = params;
    if (key) {
      result = params[key];
    }
    if (Array.isArray(result)) {
      result = result.map((res) => Converter.from(res));
    }
    if (typeof result === "string") {
      // check if it is json string
      const containsJson = result.indexOf("{") > -1 || result.indexOf("[") > -1;
      if (containsJson) {
        try {
          result = JSON.parse(result);
        } catch (e) {
          // console.log("e L-37");
          // console.log(e);
        }
      }
    }
    if (typeof result === "object") {
      Object.keys(result).forEach((anotherKey) => {
        result[anotherKey] = Converter.from(result[anotherKey]);
      });
    }
    return result;
  }
}
