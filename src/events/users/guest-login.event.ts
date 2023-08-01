export class GuestLoginEvent {
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }
}