export class UserCreatedEvent {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
  photoURL: string;

  constructor(email: string, password: string, displayName: string, phoneNumber: string, photoURL: string) {
    this.email = email;
    this.password = password;
    this.displayName = displayName;
    this.phoneNumber = phoneNumber;
    this.photoURL = photoURL;
  }
}