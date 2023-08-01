export class UserUpdatedEvent {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
  photoURL: string;
  emailBefore: string;

  constructor(emailBefore: string,
              email: string,
              password: string,
              displayName: string,
              phoneNumber: string,
              photoURL: string) {
    this.email = email;
    this.password = password;
    this.displayName = displayName;
    this.phoneNumber = phoneNumber;
    this.photoURL = photoURL;
    this.emailBefore = emailBefore;
  }
}