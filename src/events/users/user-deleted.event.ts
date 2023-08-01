export class UserDeletedEvent {
  email: string;

  constructor(email: string) {
    this.email = email;
  }
}