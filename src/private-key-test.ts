import { projectName, projects } from "./lib/environments/firebase";

const keyElites = "";
export const getPrivateKeyPemTest: any = (name = projectName) => {
  switch (name) {
    case projects.elites:
      return keyElites;
    default:
      return "";
  }
};