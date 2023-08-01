import { DefaultPhoto, Sex, UserGroup } from "../lib";

export const defaultAdminPassword = "wwwwww";
export const defaultAdminPin = "wwwww";
export const defaultAdminEmail = "akjrockdown@gmail.com";
export const defaultAdminUser = {
  name: "akankwatsa johnson",
  fName: "johnson",
  lName: "akankwatsa",
  email: defaultAdminEmail,
  pin: defaultAdminPassword,
  password: defaultAdminPassword,
  sex: Sex.MALE,
  phoneNo: "+256704676296",
  userGroup: UserGroup.ADMIN,
  photo: DefaultPhoto.MALE
};

export interface DefaultUser {
  name: string;
  fName?: string;
  lName?: string;
  email: string;
  pin: string;
  password: string;
  sex: Sex;
  phoneNo: string;
  userGroup: UserGroup;
  photo: string;
}

export const defaultUsers: DefaultUser[] = [
  {
    name: "akankwatsa johnson",
    fName: "johnson",
    lName: "akankwatsa",
    email: defaultAdminEmail,
    pin: defaultAdminPassword,
    password: defaultAdminPassword,
    sex: Sex.MALE,
    phoneNo: "+256704676296",
    userGroup: UserGroup.ADMIN,
    photo: DefaultPhoto.MALE
  }
];
