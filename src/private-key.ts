import { efrisInProduction, projectName, projects } from "./lib/environments/firebase";
import { getPrivateKeyPemTest } from "./private-key-test";

const keyElites = "";
export const getPrivateKeyPem: any = (name = projectName) => {
  if (!efrisInProduction) {
    return getPrivateKeyPemTest(name);
  }
  switch (name) {
    case projects.elites:
      return keyElites;
    default:
      return "";
  }
};