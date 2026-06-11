import { useEffect, useState, useMemo } from "react";
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  getDoc,
  where
} from "firebase/firestore";
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  FileText, 
  Car, 
  CheckSquare, 
  Users, 
  Settings, 
  LogOut, 
  LogIn, 
  Bell, 
  Menu, 
  X,
  Plus,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  UserCheck,
  Building2,
  BookmarkCheck,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { 
  UserProfile, 
  Vehicle, 
  VehicleRequest, 
  InAppNotification, 
  ActiveTab, 
  UserRole 
} from "./types";
import CalendarView from "./components/CalendarView";
import RequestForm from "./components/RequestForm";
import VehicleForm from "./components/VehicleForm";
import ReportView from "./components/ReportView";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Database Synchronizations
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  // Navigation & Interactivity states
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Admin management actions
  const [selectedVehicleToEdit, setSelectedVehicleToEdit] = useState<Vehicle | null>(null);
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Helper date parsing
  const toDateValue = (val: any) => {
    if (!val) return new Date();
    if (typeof val.toDate === "function") return val.toDate();
    return new Date(val);
  };

  // 1. Listen for Authentication Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        setCurrentUser(user);
        
        // Setup direct profile listener
        const userRef = doc(db, "users", user.uid);
        onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // First time registration
            const isSuper = user.email === "operasional.scb@gmail.com";
            const initialRole: UserRole = isSuper ? "superadmin" : "user";
            
            const newProfile: UserProfile = {
              id: user.uid,
              email: user.email || "",
              name: user.displayName || user.email?.split("@")[0] || "User SCB",
              role: initialRole,
              updatedAt: new Date()
            };

            try {
              await setDoc(userRef, newProfile);
              setUserProfile(newProfile);
            } catch (err) {
              console.error("Gagal mendaftarkan profil pengguna baru: ", err);
            }
          }
        });
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Hydrate Database Collections once signed in
  useEffect(() => {
    if (!currentUser) return;

    // A. Vehicles Real-Time Listener
    const unsubVehicles = onSnapshot(collection(db, "vehicles"), (snap) => {
      const list: Vehicle[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Vehicle));
      setVehicles(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "vehicles");
    });

    // B. Requests Real-Time Listener
    const unsubRequests = onSnapshot(collection(db, "requests"), (snap) => {
      const list: VehicleRequest[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as VehicleRequest));
      setRequests(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "requests");
    });

    // C. Users Listener (visible for admins / super admins only)
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => list.push(d.data() as UserProfile));
      setUsers(list);
    }, (error) => {
      console.warn("User collection sync skip (expected for non-admins): ", error.message);
    });

    // D. Notifications Sync (Specific to this user)
    const qNotifications = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid)
    );
    const unsubNotifications = onSnapshot(qNotifications, (snap) => {
      const list: InAppNotification[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, ...data } as InAppNotification);
      });
      // Sort in-app notifications descending
      list.sort((a, b) => toDateValue(b.createdAt).getTime() - toDateValue(a.createdAt).getTime());
      setNotifications(list);
    }, (error) => {
      console.warn("Notification listener error: ", error.message);
    });

    return () => {
      unsubVehicles();
      unsubRequests();
      unsubUsers();
      unsubNotifications();
    };
  }, [currentUser]);

  // Role permissions checking helpers
  const isSuperadmin = userProfile?.role === "superadmin" || currentUser?.email === "operasional.scb@gmail.com";
  const isAdminRole = isSuperadmin || userProfile?.role === "admin";

  // Google Login popup trigger
  const handleLoginGoogle = async () => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Gagal login Google Account: ", err);
      alert("Gagal melakukan login. Silakan coba kembali.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    setActiveTab("dashboard");
  };

  // Helper function to push real-time notifications to users
  const triggerNotification = async (targetUserId: string, title: string, message: string) => {
    try {
      const notifRef = doc(collection(db, "notifications"));
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: targetUserId,
        title,
        message,
        read: false,
        createdAt: new Date()
      });
    } catch (err) {
      console.error("Gagal mem-posting notifikasi: ", err);
    }
  };

  // Notify all Admins and Superadmins
  const notifyAdmins = async (title: string, message: string) => {
    try {
      const admins = users.filter((u) => u.role === "admin" || u.role === "superadmin");
      for (const admin of admins) {
        if (admin.id !== currentUser.uid) {
          await triggerNotification(admin.id, title, message);
        }
      }
    } catch (err) {
      console.error("Admins alert alert failed: ", err);
    }
  };

  // 3. BOOKING REQ ON SUCCESS
  const handleBookingSubmitted = async (reqPayload: Partial<VehicleRequest>) => {
    const reqRef = doc(collection(db, "requests"));
    const finalPayload = {
      id: reqRef.id,
      ...reqPayload,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await setDoc(reqRef, finalPayload);
      
      // Notify inside app
      await triggerNotification(
        currentUser.uid, 
        "Pengajuan Terkirim", 
        `Pengajuan penggunaan ${reqPayload.vehicleName} berhasil didaftarkan.`
      );

      // Notify Admins
      await notifyAdmins(
        "Pengajuan Baru", 
        `Peminjaman baru diajukan oleh ${reqPayload.pic} untuk ${reqPayload.vehicleName}.`
      );

      setActiveTab("dashboard");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `requests/${reqRef.id}`);
    }
  };

  // 4. VEHICLES SAVE ACTIONS
  const handleSaveVehicle = async (payload: Partial<Vehicle>) => {
    setAuthLoading(true);
    try {
      if (selectedVehicleToEdit) {
        // UPDATE
        const vRef = doc(db, "vehicles", selectedVehicleToEdit.id);
        const updatedVehicle = {
          ...payload,
          updatedAt: new Date()
        };
        await updateDoc(vRef, updatedVehicle);
        
        await triggerNotification(
          currentUser.uid, 
          "Kendaraan DIubah", 
          `Data kendaraan ${payload.name} berhasil diubah.`
        );
      } else {
        // CREATE
        const vRef = doc(collection(db, "vehicles"));
        const newVehicle = {
          id: vRef.id,
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await setDoc(vRef, newVehicle);

        await triggerNotification(
          currentUser.uid, 
          "Kendaraan Didaftarkan", 
          `Kendaraan operasional ${payload.name} berhasil ditambahkan.`
        );
      }
      setSelectedVehicleToEdit(null);
      setIsAddingVehicle(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "vehicles");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDeleteVehicle = async (vId: string) => {
    setAuthLoading(true);
    try {
      const vRef = doc(db, "vehicles", vId);
      await deleteDoc(vRef);
      setSelectedVehicleToEdit(null);
      setIsAddingVehicle(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `vehicles/${vId}`);
    } finally {
      setAuthLoading(false);
    }
  };

  // 5. APPROVAL PROCESSING
  const handleApproveRequest = async (req: VehicleRequest) => {
    try {
      const reqRef = doc(db, "requests", req.id);
      await updateDoc(reqRef, {
        status: "approved",
        updatedAt: new Date()
      });

      // Send User notifications
      await triggerNotification(
        req.userId,
        "Pengajuan Disetujui",
        `Pengajuan penggunaan ${req.vehicleName} untuk ${req.activity} disetujui oleh admin.`
      );

      // Inform other members
      await notifyAdmins(
        "Jadwal Kendaraan Diperbarui",
        `Jadwal kendaraan ${req.vehicleName} telah disetujui untuk ${req.pic}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requests/${req.id}`);
    }
  };

  const handleMarkCompleted = async (req: VehicleRequest) => {
    try {
      const reqRef = doc(db, "requests", req.id);
      await updateDoc(reqRef, {
        status: "completed",
        updatedAt: new Date()
      });

      await triggerNotification(
        req.userId,
        "Perjalanan Selesai",
        `Terima kasih. Penggunaan kendaraan ${req.vehicleName} telah ditandai Selesai.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requests/${req.id}`);
    }
  };

  const handleOpenRejectModal = (reqId: string) => {
    setRejectionRequestId(reqId);
    setRejectionReason("");
  };

  const handleRejectRequestSubmit = async () => {
    if (!rejectionRequestId || !rejectionReason.trim()) return;

    try {
      const reqRef = doc(db, "requests", rejectionRequestId);
      const reqDoc = await getDoc(reqRef);
      const reqData = reqDoc.data() as VehicleRequest;

      await updateDoc(reqRef, {
        status: "rejected",
        rejectionReason: rejectionReason.trim(),
        updatedAt: new Date()
      });

      // Notify the applicant
      await triggerNotification(
        reqData.userId,
        "Pengajuan Ditolak",
        `Pengajuan penggunaan ${reqData.vehicleName} untuk ${reqData.activity} ditolak: "${rejectionReason.trim()}".`
      );

      setRejectionRequestId(null);
      setRejectionReason("");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requests/${rejectionRequestId}`);
    }
  };

  // 6. USERS MANAGEMENT (SUPERADMIN ONLY)
  const handleUpdateUserRole = async (uId: string, role: UserRole) => {
    if (!isSuperadmin) return;
    try {
      const uRef = doc(db, "users", uId);
      await updateDoc(uRef, {
        role,
        updatedAt: new Date()
      });

      await triggerNotification(
        uId,
        "Akses Akun Diperbarui",
        `Peran penugasan akun Anda di SCB-GO telah diubah menjadi: ${role.toUpperCase()}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uId}`);
    }
  };

  // Notification read/unread mark helpers
  const handleMarkNotificationRead = async (nId: string) => {
    try {
      const nRef = doc(db, "notifications", nId);
      await updateDoc(nRef, { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearNotification = async (nId: string) => {
    try {
      const nRef = doc(db, "notifications", nId);
      await deleteDoc(nRef);
    } catch (err) {
      console.error(err);
    }
  };

  // Unread badge count
  const unreadNotifCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Statistics summaries logic
  const statistics = useMemo(() => {
    const totalVehiclesCount = vehicles.length;
    
    // Vehicles currently under repair or unavailable
    const outOfServiceCount = vehicles.filter((v) => v.status !== "active").length;

    // Check currently active / approved trip today
    const todayStr = new Date().toISOString().slice(0, 10);
    const inUseTodayCount = requests.filter((r) => {
      return r.status === "approved" && todayStr >= r.startDate && todayStr <= r.endDate;
    }).length;

    const availableCount = Math.max(0, vehicles.filter((v) => v.status === "active").length - inUseTodayCount);

    // Current month requests counter
    const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentMonthCount = requests.filter((r) => r.startDate.startsWith(currentMonthPrefix)).length;

    return {
      total: totalVehiclesCount,
      available: availableCount,
      inUseToday: inUseTodayCount,
      monthTotal: currentMonthCount,
    };
  }, [vehicles, requests]);

  // Calendar quick upcoming bookings filtered list
  const upcomingBookings = useMemo(() => {
    const nowMs = new Date().getTime();
    return requests
      .filter((r) => r.status === "approved" && toDateValue(r.startAt).getTime() >= nowMs)
      .sort((a, b) => toDateValue(a.startAt).getTime() - toDateValue(b.startAt).getTime())
      .slice(0, 5);
  }, [requests]);

  // Filter requests of the current signed-in user
  const myRequests = useMemo(() => {
    return requests
      .filter((r) => r.userId === currentUser?.uid)
      .sort((a, b) => toDateValue(b.createdAt).getTime() - toDateValue(a.createdAt).getTime());
  }, [requests, currentUser]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
          SCB-GO • Menghubungkan Infrastruktur Operasional...
        </p>
      </div>
    );
  }

  // SIGN OUT / LANDING PORTAL GUEST VIEW
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 selection:bg-blue-100">
        <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 p-8 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 shadow-sm">
          {/* Logo brand & Title */}
          <div className="flex flex-col justify-between py-2">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-md">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-display font-black text-2xl text-blue-900 leading-none">SCB-GO</h1>
                  <p className="text-[10px] uppercase font-mono tracking-widest text-blue-600 font-bold">Sekolah Cendekia BAZNAS</p>
                </div>
              </div>

              <h2 className="font-display font-extrabold text-slate-800 text-3xl leading-tight tracking-tight">
                Sistem Peminjaman & Jadwal Kendaraan Operasional
              </h2>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed font-medium">
                Pantau ketersediaan, jadwalkan bepergian, dan koordinasikan pengantaran logistik bagi seluruh civitas akademis Sekolah Cendekia BAZNAS secara transparan, akurat, dan real-time.
              </p>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Akses Terproteksi Akun Google</h4>
                  <p className="text-[11px] text-slate-500 leading-normal font-medium mt-0.5">
                    Gunakan alamat surat elektronik (Gmail) resmi Anda untuk mengakses sistem pengajuan kendaraan operasional.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Login Control Card */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl border border-slate-150 p-6 flex flex-col justify-center text-center">
            <h3 className="font-display font-bold text-slate-800 text-xl">Silakan Masuk</h3>
            <p className="text-xs text-slate-400 mt-1 font-semibold">Gunakan Akun Google Sekolah (Gmail)</p>

            <button
              onClick={handleLoginGoogle}
              className="mt-8 flex items-center justify-center gap-3 w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-2xl shadow-xs hover:bg-slate-50 hover:shadow-sm transition-all cursor-pointer"
            >
              {/* Google SVG Icon */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.116C18.22 1.91 15.44 1 12.24 1 5.955 1 1 5.955 1 12.24s4.955 11.24 11.24 11.24c6.558 0 10.92-4.615 10.92-11.115 0-.749-.074-1.32-.174-1.885h-10.746z"
                />
              </svg>
              Masuk Dengan Akun Google
            </button>

            <div className="mt-8 text-left space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fitur Utama</span>
              <ul className="space-y-2 text-xs font-semibold text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  Real-time Jadwal & Kalender Operasional
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  Pengecekan Otomatis Bentrok Jadwal
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  Notifikasi Kabar Persetujuan Instan
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // NAVIGATION TAB COMPONENT SELECTOR
  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            {/* KPI Metrics Dashboard Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-banner">
              {/* Total Vehicles */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-24">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1 block">Total Kendaraan</span>
                <div className="flex items-end justify-between">
                  <h3 className="text-2xl font-extrabold text-slate-800 font-display leading-none">{statistics.total}</h3>
                  <span className="text-blue-600 bg-blue-50 text-[10px] px-2 py-0.5 rounded font-bold">Semua Unit</span>
                </div>
              </div>

              {/* Available */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-24">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1 block">Unit Tersedia</span>
                <div className="flex items-end justify-between">
                  <h3 className="text-2xl font-extrabold text-emerald-600 font-display leading-none">{statistics.available}</h3>
                  <span className="text-emerald-700 bg-emerald-50 text-[10px] px-2 py-0.5 rounded font-bold">Aktif</span>
                </div>
              </div>

              {/* In Use Today */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-24">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1 block">Digunakan Hari Ini</span>
                <div className="flex items-end justify-between">
                  <h3 className="text-2xl font-extrabold text-amber-600 font-display leading-none">{statistics.inUseToday}</h3>
                  <span className="text-amber-700 bg-amber-50 text-[10px] px-2 py-0.5 rounded font-bold">On Road</span>
                </div>
              </div>

              {/* Month Total request counter */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-24">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1 block">Pengajuan Bulan Ini</span>
                <div className="flex items-end justify-between">
                  <h3 className="text-2xl font-extrabold text-slate-800 font-display leading-none">{statistics.monthTotal}</h3>
                  <span className="text-slate-600 bg-slate-100 text-[10px] px-2 py-0.5 rounded font-bold">Total Request</span>
                </div>
              </div>
            </div>

            {/* Split layout: main calendar schedule + upcoming alerts side panels */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <CalendarView requests={requests} onAddRequest={() => setActiveTab("request")} />
              </div>

              <div className="space-y-6">
                {/* Regular User Status panel */}
                <div className="bg-white rounded-2xl border border-blue-50 p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <BookmarkCheck className="w-4 h-4 text-blue-600" />
                      Status Pengajuan Saya
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold">{myRequests.length} Total</span>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {myRequests.length === 0 ? (
                      <div className="text-center py-8 text-xs font-semibold text-slate-400">
                        Anda belum pernah mengirim pengajuan kendaraan.
                      </div>
                    ) : (
                      myRequests.map((req) => (
                        <div key={req.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span className="truncate max-w-[120px]">{req.vehicleName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              req.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                              req.status === "rejected" ? "bg-rose-100 text-rose-800" :
                              req.status === "completed" ? "bg-blue-100 text-blue-800" :
                              "bg-amber-100 text-amber-800"
                            }`}>
                              {req.status === "pending" ? "Menunggu" : req.status === "approved" ? "Disetujui" : req.status === "rejected" ? "Ditolak" : "Selesai"}
                            </span>
                          </div>
                          <p className="text-slate-500 font-semibold truncate italic">"{req.activity}"</p>
                          <div className="text-[10px] text-slate-400 font-bold mt-1">
                            {req.startDate} ({req.startTime}) s/d {req.endDate}
                          </div>
                          {req.status === "rejected" && req.rejectionReason && (
                            <div className="mt-1.5 p-2 bg-rose-50 text-rose-600 text-[10px] rounded-lg border border-rose-100">
                              <strong>Alasan:</strong> {req.rejectionReason}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Upcoming approved trips */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <CalendarIcon className="w-5 h-5 text-emerald-600" />
                      Jadwal Bepergian Terdekat
                    </h3>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {upcomingBookings.length === 0 ? (
                      <div className="text-center py-8 text-xs font-semibold text-slate-400">
                        Tidak ada keberangkatan terjadwal.
                      </div>
                    ) : (
                      upcomingBookings.map((req) => (
                        <div key={req.id} className="p-3 border-l-4 border-emerald-500 bg-slate-50 rounded-r-xl space-y-1 text-xs">
                          <h4 className="font-bold text-slate-800">{req.vehicleName}</h4>
                          <p className="text-slate-500 font-semibold italic">"{req.activity}"</p>
                          <p className="text-slate-400 font-semibold">{req.pic} • Ke: {req.destination}</p>
                          <div className="text-[10px] text-emerald-600 font-bold mt-1">
                            Mulai: {req.startDate} @ {req.startTime}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "calendar":
        return <CalendarView requests={requests} onAddRequest={() => setActiveTab("request")} />;

      case "request":
        return (
          <RequestForm 
            vehicles={vehicles} 
            currentUser={currentUser} 
            onSuccess={handleBookingSubmitted} 
          />
        );

      case "vehicles":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add / Edit Form Panel */}
            <div className="lg:col-span-1">
              {(isAddingVehicle || selectedVehicleToEdit) && isAdminRole ? (
                <VehicleForm
                  vehicleToEdit={selectedVehicleToEdit}
                  onSave={handleSaveVehicle}
                  onDelete={handleDeleteVehicle}
                  onCancel={() => {
                    setSelectedVehicleToEdit(null);
                    setIsAddingVehicle(false);
                  }}
                />
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
                  <Car className="w-10 h-10 text-slate-350 mb-3 animate-pulse" />
                  <h4 className="font-bold text-slate-700 text-sm">Dashboard Kendaraan</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                    {isAdminRole 
                      ? "Pilih salah satu kendaraan untuk diubah, atau tambahkan armada baru lewat tombol."
                      : "Pilih tab lain atau hubungi Admin bagian sarana prasarana jika ingin mendaftarkan armada."}
                  </p>
                  {isAdminRole && (
                    <button
                      onClick={() => {
                        setSelectedVehicleToEdit(null);
                        setIsAddingVehicle(true);
                      }}
                      className="mt-6 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-blue-750 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Tambah Kendaraan
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Vehicles catalog listing */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">Daftar Seluruh Armada Sekolah ({vehicles.length})</h3>
              </div>

              {vehicles.length === 0 ? (
                <div className="p-8 bg-white text-center border rounded-2xl text-slate-400 font-semibold text-xs">
                  Tidak ada data kendaraan operasional di database.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicles.map((v) => (
                    <div key={v.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                      {/* Status indicator badge */}
                      <span className={`absolute top-0 right-0 px-3 py-1 text-[9px] font-bold uppercase rounded-bl border-l border-b border-slate-200 ${
                        v.status === "active" ? "bg-emerald-50 text-emerald-700 border-l-emerald-100 border-b-emerald-100" :
                        v.status === "repair" ? "bg-amber-50 text-amber-700 border-l-amber-100 border-b-amber-100" :
                        "bg-slate-50 text-slate-500 border-l-slate-150 border-b-slate-150"
                      }`}>
                        {v.status === "active" ? "Aktif" : v.status === "repair" ? "Dalam Perbaikan" : "Kosong"}
                      </span>

                      <div>
                        <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                          <Car className="w-4 h-4 text-blue-600" />
                          {v.name}
                        </h4>
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md mt-1 font-mono">
                          {v.plateNo}
                        </span>

                        <div className="mt-3.5 space-y-1 h-14 overflow-y-auto text-xs text-slate-500 font-semibold">
                          <p>Jenis: <strong className="text-slate-700">{v.type}</strong></p>
                          <p>Kapasitas: <strong className="text-slate-700">{v.capacity} Penumpang</strong></p>
                          {v.description && <p className="italic font-normal mt-1 border-t border-slate-50 pt-1">"{v.description}"</p>}
                        </div>
                      </div>

                      {isAdminRole && (
                        <div className="border-t border-slate-50 pt-3 mt-4 flex justify-end">
                          <button
                            onClick={() => {
                              setSelectedVehicleToEdit(v);
                              setIsAddingVehicle(false);
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-750 hover:underline"
                          >
                            Ubah Detail & Status
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "approvals":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Validasi & Alur Persetujuan Pengajuan Kendaraan</h3>
              <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full">
                {requests.filter((r) => r.status === "pending").length} Menunggu
              </span>
            </div>

            {requests.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white border border-slate-100 rounded-2xl italic text-xs">
                Belum ada pengajuan kendaraan masuk.
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div key={req.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-base">{req.vehicleName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          req.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          req.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-100" :
                          req.status === "completed" ? "bg-blue-50 text-blue-700 border-blue-100" :
                          "bg-amber-50 text-amber-700 border-amber-100"
                        }`}>
                          {req.status === "pending" ? "Menunggu Persetujuan" : req.status === "approved" ? "Disetujui" : req.status === "rejected" ? "Ditolak" : "Selesai"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-1 text-slate-500 font-semibold text-xs">
                        <p>Penanggung Jawab: <strong className="text-slate-700">{req.pic}</strong></p>
                        <p>Tujuan: <strong className="text-slate-700">{req.destination}</strong></p>
                        <p>Kegiatan: <span className="text-slate-600 font-normal italic">"{req.activity}"</span></p>
                        <p>Peminjam: <strong className="text-slate-700">{req.userName} ({req.userEmail})</strong></p>
                        <p>Waktu: <strong className="text-blue-600">{req.startDate} ({req.startTime}) s/d {req.endDate} ({req.endTime})</strong></p>
                        <p>Jumlah Penumpang: <strong className="text-slate-700">{req.passengerCount} Pax</strong></p>
                      </div>

                      {req.passengers && req.passengers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="text-[10px] text-slate-400 font-bold mr-1 self-center">Penumpang: </span>
                          {req.passengers.map((p, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}

                      {req.additionalNotes && (
                        <p className="text-[11px] text-slate-400 italic">Tambahan: "{req.additionalNotes}"</p>
                      )}

                      {req.status === "rejected" && req.rejectionReason && (
                        <div className="mt-2 p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl">
                          <strong>Alasan Penolakan:</strong> {req.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* ACTIONS FOR ADMINS */}
                    {isAdminRole && (
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {req.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApproveRequest(req)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleOpenRejectModal(req.id)}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                            >
                              Tolak Pengajuan
                            </button>
                          </>
                        )}
                        {req.status === "approved" && (
                          <button
                            onClick={() => handleMarkCompleted(req)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                          >
                            Tandai Selesai
                          </button>
                        )}
                        {/* Remove capability */}
                        {isSuperadmin && (
                          <button
                            onClick={async () => {
                              if (window.confirm("Hapus dokumen pengajuan ini?")) {
                                await deleteDoc(doc(db, "requests", req.id));
                              }
                            }}
                            className="p-2 border border-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "reports":
        return <ReportView requests={requests} />;

      case "users":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Pemetaan Hak Akses Pengguna SCB-GO</h3>
              {isSuperadmin ? (
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">MODE SUPER ADMIN</span>
              ) : (
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-semibold">BACA SAJA</span>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-slate-700 text-xs text-left">
                <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-5">Nama Lengkap</th>
                    <th className="py-4 px-4">Email Google</th>
                    <th className="py-4 px-4 text-center">Hak Akses Role</th>
                    {isSuperadmin && <th className="py-4 px-5 text-right">Opsi Ganti Akses</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((profile) => (
                    <tr key={profile.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-5 font-bold text-slate-800">{profile.name}</td>
                      <td className="py-4 px-4 text-slate-500 font-medium">{profile.email}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 text-[9px] font-semibold rounded-full uppercase ${
                          profile.role === "superadmin" ? "bg-red-50 text-red-700 border border-red-100" :
                          profile.role === "admin" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {profile.role}
                        </span>
                      </td>
                      {isSuperadmin && (
                        <td className="py-4 px-5 text-right">
                          {profile.email === "operasional.scb@gmail.com" ? (
                            <span className="text-[10px] text-slate-400 font-bold">Super Admin Permanen</span>
                          ) : (
                            <select
                              value={profile.role}
                              onChange={(e) => handleUpdateUserRole(profile.id, e.target.value as UserRole)}
                              className="p-1 px-2 border rounded-xl bg-slate-50/50 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[10px] font-bold text-slate-700"
                            >
                              <option value="user">User biasa</option>
                              <option value="admin">Admin operasional</option>
                              <option value="superadmin">Super Admin</option>
                            </select>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={currentUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"}
                  alt="user avatar"
                  className="w-14 h-14 rounded-full border-2 border-blue-600 shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-none">{currentUser.displayName}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 font-mono">{currentUser.email}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-450 uppercase block">Peran Hak Akses</span>
                  <span className="text-blue-700 font-bold text-sm block mt-0.5 uppercase">{userProfile?.role || "user"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-450 uppercase block">Terakhir Masuk</span>
                  <span className="text-slate-600 block mt-0.5">{new Date().toLocaleDateString("id-ID", { dateStyle: "medium" })}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-blue-50 p-6 shadow-xs">
              <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-1.5">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                Informasi Sekolah Cendekia BAZNAS (SCB)
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Sekolah Cendekia BAZNAS adalah sekolah bebas biaya berasrama yang ditujukan bagi mustahik berprestasi di seluruh wilayah Indonesia. Sistem SCB-GO ini digunakan sebagai fasilitasi tata kelola kendaraan operasional kampus secara cerdas, aman, dan disiplin waktu.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-450">
                <span>Versi Aplikasi: SCB-GO v1.0.0</span>
                <span>Hubungi: operasional.scb@gmail.com</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-700 flex flex-col md:flex-row relative">
      
      {/* 1. SIDEBAR Navigation rail */}
      <aside className="w-64 bg-slate-900 text-slate-100 shrink-0 hidden md:flex flex-col justify-between p-6 border-r border-slate-800 shadow-sm sticky h-screen top-0 select-none">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-850">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-base tracking-wide shadow-lg shadow-blue-900/50">
              SCB
            </div>
            <div>
              <h1 className="font-display font-bold text-sm tracking-widest text-white leading-none">SCB-GO</h1>
              <p className="text-[9px] uppercase font-bold text-slate-400 mt-1 tracking-wider">Sekolah Cendekia BAZNAS</p>
            </div>
          </div>

          {/* Menus list layout */}
          <nav className="space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-3">Main Navigation</span>
            
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "dashboard" ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-slate-400" />
              Dashboard Ringkasan
            </button>

            <button
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "calendar" ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              Kalender Jadwal
            </button>

            <button
              onClick={() => setActiveTab("request")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "request" ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <FileText className="w-4 h-4 text-slate-400" />
              Pengajuan Kendaraan
            </button>

            <button
              onClick={() => setActiveTab("vehicles")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "vehicles" ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Car className="w-4 h-4 text-slate-400" />
              Data Kendaraan
            </button>

            <button
              onClick={() => setActiveTab("approvals")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "approvals" ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <CheckSquare className="w-4 h-4 text-slate-400" />
              Persetujuan Peminjaman
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "reports" ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <FileText className="w-4 h-4 text-slate-400" />
              Laporan Penggunaan
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "users" ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Users className="w-4 h-4 text-slate-400" />
              Kelola Pengguna
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "settings" ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Pengaturan Profil
            </button>
          </nav>
        </div>

        {/* User Card inside bottom sidebar */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/40 rounded-lg">
            <img
              src={currentUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=70&h=70&q=80"}
              alt="useravatar"
              className="w-8 h-8 rounded-full border border-slate-700 shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div className="truncate flex-1">
              <h4 className="text-xs font-bold text-white truncate leading-none">{currentUser.displayName}</h4>
              <p className="text-[10px] text-slate-500 mt-1 truncate capitalize font-mono">{userProfile?.role || "user"}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition-all text-xs font-bold cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER RESPONSIVE VIEWER BAR */}
      <header className="md:hidden w-full bg-slate-900 text-slate-100 p-4 flex items-center justify-between shadow-md sticky top-0 z-40 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 px-2 rounded-lg hover:bg-slate-800 text-white transition-all text-xs font-bold cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display font-bold text-sm leading-none text-white uppercase tracking-wider">SCB-GO</h1>
            <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Sekolah Cendekia BAZNAS</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="relative p-1.5 hover:bg-slate-800 rounded-xl text-white transition-all text-xs cursor-pointer"
          >
            <Bell className="w-5 h-5 text-slate-350" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-rose-600 text-white font-semibold text-[9px] rounded-full flex items-center justify-center leading-none">
                {unreadNotifCount}
              </span>
            )}
          </button>

          <img
            src={currentUser.photoURL || "https://images.unsplash.com/photo-1544005313-94ddf0286df2"}
            alt="avatar"
            className="w-8 h-8 rounded-full border border-slate-700"
            referrerPolicy="no-referrer"
          />
        </div>
      </header>

      {/* MOBILE NAVIGATION SIDE DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex" id="mobile-sidebar-drawer">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-950"
            />

            {/* Sidebar window */}
            <motion.div
              initial={{ translateX: "-100%" }}
              animate={{ translateX: "0%" }}
              exit={{ translateX: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="w-[270px] bg-slate-900 text-slate-100 p-6 relative flex flex-col justify-between h-full z-10"
            >
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-5 right-5 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all font-bold text-xs cursor-pointer"
              >
                ✕
              </button>

              <div className="space-y-6 mt-4">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-850">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-base tracking-wide">
                    SCB
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm tracking-widest text-white leading-none">SCB-GO</h2>
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Sekolah Cendekia BAZNAS</p>
                  </div>
                </div>

                <nav className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-3 mb-2">Navigation Map</span>
                  
                  {[
                    { tab: "dashboard", icon: <LayoutDashboard className="w-4 h-4 text-slate-450" />, label: "Dashboard" },
                    { tab: "calendar", icon: <CalendarIcon className="w-4 h-4 text-slate-450" />, label: "Kalender Jadwal" },
                    { tab: "request", icon: <FileText className="w-4 h-4 text-slate-450" />, label: "Pengajuan" },
                    { tab: "vehicles", icon: <Car className="w-4 h-4 text-slate-450" />, label: "Mobil Operasional" },
                    { tab: "approvals", icon: <CheckSquare className="w-4 h-4 text-slate-450" />, label: "Alur Persetujuan" },
                    { tab: "reports", icon: <FileText className="w-4 h-4 text-slate-450" />, label: "Laporan" },
                    { tab: "users", icon: <Users className="w-4 h-4 text-slate-450" />, label: "Hak Akses Akun" },
                    { tab: "settings", icon: <Settings className="w-4 h-4 text-slate-450" />, label: "Akun Profil" }
                  ].map((item) => (
                    <button
                      key={item.tab}
                      onClick={() => {
                        setActiveTab(item.tab as ActiveTab);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        activeTab === item.tab ? "bg-blue-600 text-white font-semibold shadow-inner shadow-blue-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <img
                    src={currentUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde"}
                    alt="userp"
                    className="w-8 h-8 rounded-full border border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-white truncate leading-none">{currentUser.displayName}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 truncate capitalize font-mono leading-none">{userProfile?.role}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1 px-2.5 rounded-lg border border-slate-700 hover:bg-rose-650/10 text-slate-400 hover:text-rose-400 font-semibold transition-all text-xs cursor-pointer"
                >
                  Keluar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. MAIN HUB WORKSPACE Area content wrapper */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Desktop top master bar */}
        <header className="hidden md:flex items-center justify-between h-16 px-8 border-b border-slate-200 bg-white" id="desktop-top-header">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider leading-none">
              {activeTab === "dashboard" ? "Dashboard Ringkasan Utama" :
               activeTab === "calendar" ? "Kalender Jadwal Kendaraan" :
               activeTab === "request" ? "Pendaftaran Formulir Pengajuan" :
               activeTab === "vehicles" ? "Kelola Seluruh Armada Sekolah" :
               activeTab === "approvals" ? "Persetujuan & Validasi Peminjaman" :
               activeTab === "reports" ? "Unduh / Cetak Laporan Peminjaman" :
               activeTab === "users" ? "Otorisasi & Hak Akses Pengguna" :
               "Ubah Pengaturan Profil Akun"}
            </h2>
            <p className="text-[10px] text-slate-400 mt-1.5 uppercase tracking-tight font-medium">
              Selamat bekerja, ustadz/ustadzah • {new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time sync notifier indicator */}
            <div className="flex items-center gap-1.5 border border-emerald-100 bg-emerald-50 text-emerald-700 p-1.5 px-3 rounded text-[10px] font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              SINKRONISASI AKTIF
            </div>

            {/* Notification drop indicator */}
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative p-2 hover:bg-slate-55 rounded-lg text-slate-500 transition-all border border-slate-200 cursor-pointer"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center leading-none">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Central tab contents workspace viewport container */}
        <section className="flex-1 p-4 md:p-6" id="central-tab-viewports">
          {renderTabContent()}
        </section>
      </main>

      {/* 4. REAL-TIME IN-APP NOTIFICATION SIDE DRAWER */}
      <AnimatePresence>
        {notificationOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end" id="notif-drawer-container">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotificationOpen(false)}
              className="absolute inset-0 bg-slate-950"
            />

            {/* Panel */}
            <motion.div
              initial={{ translateX: "100%" }}
              animate={{ translateX: "0%" }}
              exit={{ translateX: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="w-[360px] max-w-full bg-white h-full relative p-6 flex flex-col justify-between shadow-xl z-10"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-blue-50 mb-4">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-800 text-sm">Notifikasi Masuk</h3>
                  </div>
                  <button
                    onClick={() => setNotificationOpen(false)}
                    className="p-1 px-2 text-slate-400 hover:text-slate-600 font-bold transition-all text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[80vh] custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="text-center py-12 text-xs font-semibold text-slate-400">
                      Kotak masuk notifikasi Anda saat ini kosong.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`p-3.5 rounded-xl border relative text-xs transition-all ${
                          notif.read ? "bg-slate-50/50 border-slate-100 text-slate-500" : "bg-blue-50/40 border-blue-100 text-slate-800 font-medium shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-800 text-xs">{notif.title}</strong>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!notif.read && (
                              <button
                                onClick={() => handleMarkNotificationRead(notif.id)}
                                className="text-[10px] text-blue-650 hover:underline font-bold"
                              >
                                Tandai Dibaca
                              </button>
                            )}
                            <button
                              onClick={() => handleClearNotification(notif.id)}
                              className="text-[10px] text-rose-500 hover:underline font-bold"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-slate-600 leading-normal font-semibold italic">"{notif.message}"</p>
                        <span className="block text-[9px] text-slate-400 font-bold mt-1.5">
                          {toDateValue(notif.createdAt).toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" })} • {toDateValue(notif.createdAt).toLocaleDateString("id", { dateStyle: "short" })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-blue-50">
                <button
                  onClick={() => setNotificationOpen(false)}
                  className="w-full text-center py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Tutup Notifikasi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. REJECTION MODAL FORM (ADMIN ONLY) */}
      {rejectionRequestId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-3xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-rose-55 w-full max-w-md shadow-xl overflow-hidden animate-scale-up">
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center justify-between text-rose-800">
              <h3 className="font-bold text-sm md:text-base">Berikan Alasan Penolakan</h3>
              <button 
                onClick={() => setRejectionRequestId(null)} 
                className="text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-normal font-semibold">
                Silakan isi alasan penolakan kendaraan agar pemohon mendapatkan umpan balik atas pembatalan ini secara real-time.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Kendaraan Toyota Hiace sudah penuh atau sedang masuk antrean perbaikan kelistrikan."
                className="w-full text-xs p-3 h-24 border rounded-xl bg-slate-50/50 outline-none focus:ring-1 focus:ring-rose-500 font-semibold resize-none"
                required
              />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setRejectionRequestId(null)}
                className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleRejectRequestSubmit}
                disabled={!rejectionReason.trim()}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50 shadow-xs transition-all cursor-pointer"
              >
                Tolak Secara Resmi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
