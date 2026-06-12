import { useState, useMemo, useEffect, FormEvent } from "react";
import { 
  Car, 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Users, 
  Plus, 
  X, 
  FileText, 
  AlertTriangle,
  CheckCircle,
  Clock3
} from "lucide-react";
import { Vehicle, VehicleRequest } from "../types";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface RequestFormProps {
  vehicles: Vehicle[];
  currentUser?: { uid: string; email: string; displayName?: string | null } | null;
  onSuccess: (request: Partial<VehicleRequest>) => void;
}

export default function RequestForm({ vehicles, currentUser, onSuccess }: RequestFormProps) {
  // Form fields
  const [vehicleId, setVehicleId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pic, setPic] = useState(currentUser?.displayName || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [activity, setActivity] = useState("");
  const [passengerCount, setPassengerCount] = useState<number>(0);
  const [passengerInput, setPassengerInput] = useState("");
  const [passengers, setPassengers] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(() => {
    if (currentUser) {
      setPic(currentUser.displayName || "");
      setEmail(currentUser.email || "");
    }
  }, [currentUser]);

  // States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Only active vehicles should be requested
  const activeVehicles = useMemo(() => {
    return vehicles.filter((v) => v.status === "active");
  }, [vehicles]);

  // Selected vehicle metadata
  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === vehicleId) || null;
  }, [vehicles, vehicleId]);

  // Add passenger name tags
  const handleAddPassenger = () => {
    if (!passengerInput.trim()) return;
    if (passengers.includes(passengerInput.trim())) return;
    setPassengers([...passengers, passengerInput.trim()]);
    setPassengerInput("");
    // Automatically increment passenger count if desired or keep it separate
    setPassengerCount(prev => prev === passengers.length ? prev + 1 : prev);
  };

  const handleRemovePassenger = (index: number) => {
    setPassengers(passengers.filter((_, idx) => idx !== index));
  };

  // Strictly check schedule overlap
  const checkBookingConflict = async (
    targetVehicleId: string,
    startMs: number,
    endMs: number
  ): Promise<boolean> => {
    try {
      const q = query(
        collection(db, "requests"),
        where("vehicleId", "==", targetVehicleId)
      );
      const querySnapshot = await getDocs(q);
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        
        // Conflicting check ONLY against approved or pending requests
        if (data.status !== "approved" && data.status !== "pending") continue;
        
        const existingStart = data.startAt.toDate().getTime();
        const existingEnd = data.endAt.toDate().getTime();
        
        // Overlap Condition: Start1 < End2 AND Start2 < End1
        if (startMs < existingEnd && existingStart < endMs) {
          return true; // Clash!
        }
      }
      return false;
    } catch (error) {
      console.error("Conflict checking database process: ", error);
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Simple fields check
    if (!vehicleId) return setErrorMsg("Silakan pilih kendaraan.");
    if (!startDate || !startTime) return setErrorMsg("Silakan masukkan tanggal dan jam mulai peminjaman.");
    if (!endDate || !endTime) return setErrorMsg("Silakan masukkan tanggal dan jam selesai peminjaman.");
    if (!pic.trim()) return setErrorMsg("Silakan isi nama Penanggung Jawab.");
    if (!email.trim() || !email.includes("@")) return setErrorMsg("Silakan masukkan email pemohon yang sah.");
    if (!activity.trim()) return setErrorMsg("Silakan isi tujuan kegiatan.");
    if (passengerCount < 0) return setErrorMsg("Jumlah penumpang tidak boleh kurang dari 0.");
    if (!destination.trim()) return setErrorMsg("Silakan isi tujuan perjalanan.");

    // Parse dates to exact millisecond representations for overlap checks
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (isNaN(startDateTime.getTime())) {
      return setErrorMsg("Format tanggal atau jam mulai tidak valid.");
    }
    if (isNaN(endDateTime.getTime())) {
      return setErrorMsg("Format tanggal atau jam selesai tidak valid.");
    }
    if (endDateTime.getTime() <= startDateTime.getTime()) {
      return setErrorMsg("Waktu selesai peminjaman harus setelah waktu mulai.");
    }

    setLoading(true);

    try {
      // OVERLAP STAGE CHECK
      const isClashing = await checkBookingConflict(
        vehicleId,
        startDateTime.getTime(),
        endDateTime.getTime()
      );

      if (isClashing) {
        setLoading(false);
        return setErrorMsg(
          "Jadwal kendaraan tidak tersedia karena sudah digunakan pada waktu tersebut."
        );
      }

      // If safe, build request payload
      const requestPayload: Partial<VehicleRequest> = {
        vehicleId,
        vehicleName: selectedVehicle ? selectedVehicle.name : "Kendaraan SCB",
        startDate,
        startTime,
        endDate,
        endTime,
        startAt: startDateTime,
        endAt: endDateTime,
        pic: pic.trim(),
        activity: activity.trim(),
        passengerCount,
        passengers,
        destination: destination.trim(),
        additionalNotes: additionalNotes.trim(),
        status: "pending" as const,
        rejectionReason: "",
        userId: currentUser ? currentUser.uid : "guest_user",
        userEmail: email.trim(),
        userName: pic.trim(),
      };

      await onSuccess(requestPayload);
      
      setSuccessMsg("Pengajuan peminjaman kendaraan berhasil dikirim!");
      
      // Reset form
      setVehicleId("");
      setActivity("");
      setPassengerCount(0);
      setPassengers([]);
      setDestination("");
      setAdditionalNotes("");
    } catch (err) {
      console.error("Form submission process failed: ", err);
      setErrorMsg("Gagal menyimpan pengajuan: " + (err instanceof Error ? err.message : "Kesalahan tidak dikenal"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="booking-request-form">
      {/* Container header */}
      <div className="p-6 border-b border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center text-blue-600">
          <Clock3 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Formulir Pengisian Pengajuan</h2>
          <p className="text-xs text-slate-400 mt-0.5">Ajukan pendaftaran bepergian untuk kegiatan sekolah</p>
        </div>
      </div>

      <div className="p-6">
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold mb-6 animate-shake">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2.5 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold mb-6">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Hand Form Controls */}
            <div className="space-y-4">
              {/* Vehicle selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  1. Pilih Kendaraan Operasional <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Car className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                    required
                  >
                    <option value="">-- Pilih Kendaraan Aktif --</option>
                    {activeVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.plateNo}) - Kapasitas {v.capacity} Penumpang
                      </option>
                    ))}
                  </select>
                </div>
                {selectedVehicle && (
                  <p className="text-[10px] text-blue-600 font-semibold pl-2">
                    Kapasitas maksimum: {selectedVehicle.capacity} Penumpang. Jenis: {selectedVehicle.type}
                  </p>
                )}
              </div>

              {/* Start Schedule row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                    2. Tanggal Mulai <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (!endDate) setEndDate(e.target.value);
                      }}
                      className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                    3. Jam Mulai <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* End Schedule row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                    4. Tanggal Selesai <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                    5. Jam Selesai <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* PIC input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  6. Penanggung Jawab Peminjaman <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="text"
                    value={pic}
                    onChange={(e) => setPic(e.target.value)}
                    placeholder="Nama ustadz / ustadzah / guru"
                    className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                    required
                  />
                </div>
              </div>

              {/* Email pemohon input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  7. Email Pemohon <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 text-slate-400 font-bold font-mono text-xs">@</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Masukkan email Anda"
                    className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                    required
                  />
                </div>
              </div>

              {/* Destination */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  10. Tujuan Perjalanan <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Contoh: Kantor BAZNAS Pusat Jakarta"
                    className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Right Hand Form Controls */}
            <div className="space-y-4">
              {/* Activity description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  7. Kegiatan / Keperluan Keberangkatan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  placeholder="Deskripsikan dengan detail agenda kegiatan..."
                  className="p-3 text-xs w-full h-[100px] rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 resize-none"
                  required
                />
              </div>

              {/* Number Pax list */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  8. Jumlah Penumpang <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    max={selectedVehicle?.capacity || 100}
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(parseInt(e.target.value) || 0)}
                    className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Name Tags list adding */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  9. Daftar Nama Penumpang
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={passengerInput}
                    onChange={(e) => setPassengerInput(e.target.value)}
                    placeholder="Nama Penumpang..."
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPassenger(); } }}
                    className="px-3 py-2 text-xs flex-1 rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleAddPassenger}
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-750 font-bold transition-all text-xs"
                  >
                    Tambah
                  </button>
                </div>

                {/* Display added passenger names */}
                {passengers.length > 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-wrap gap-1.5 max-h-[90px] overflow-y-auto custom-scrollbar">
                    {passengers.map((p, index) => (
                      <span
                        key={index}
                        className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full shadow-2xs"
                      >
                        {p}
                        <button
                          type="button"
                          onClick={() => handleRemovePassenger(index)}
                          className="text-slate-400 hover:text-rose-500 font-bold"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                  11. Keterangan Tambahan
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="text"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Tulis instruksi khusus, rute alternatif, dsb."
                    className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-blue-50 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? "Mengecek Overlap Jadwal..." : "12. Kirim Form Pengajuan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
