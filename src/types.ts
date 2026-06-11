export type UserRole = "superadmin" | "admin" | "user";

export interface UserProfile {
  id: string; // uid
  email: string;
  name: string;
  role: UserRole;
  updatedAt: any; // Firestore Timestamp style
}

export type VehicleStatus = "active" | "repair" | "unavailable";

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  plateNo: string;
  capacity: number;
  status: VehicleStatus;
  description: string;
  createdAt: any;
  updatedAt: any;
}

export type RequestStatus = "pending" | "approved" | "rejected" | "completed";

export interface VehicleRequest {
  id: string;
  vehicleId: string;
  vehicleName: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:MM
  startAt: any; // Firestore Timestamp
  endAt: any; // Firestore Timestamp
  pic: string;
  activity: string;
  passengerCount: number;
  passengers: string[];
  destination: string;
  additionalNotes: string;
  status: RequestStatus;
  rejectionReason: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: any;
  updatedAt: any;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export type ActiveTab =
  | "dashboard"
  | "calendar"
  | "request"
  | "vehicles"
  | "approvals"
  | "reports"
  | "users";
