import { useState, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  MapPin, 
  Users, 
  Plus,
  Info
} from "lucide-react";
import { VehicleRequest } from "../types";

interface CalendarViewProps {
  requests: VehicleRequest[];
  onAddRequest?: () => void;
}

export default function CalendarView({ requests, onAddRequest }: CalendarViewProps) {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedRequest, setSelectedRequest] = useState<VehicleRequest | null>(null);

  // Month navigation helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const handleNavigate = (direction: number) => {
    if (view === "month") navigateMonth(direction);
    else if (view === "week") navigateWeek(direction);
    else navigateDay(direction);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Helper arrays
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const dayNamesShort = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dayNamesFull = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  // Extract requests for specific date
  const getRequestsForDate = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return requests.filter((req) => {
      // Check if day falls between startDate and endDate (inclusive)
      const reqStart = req.startDate;
      const reqEnd = req.endDate;
      return dateStr >= reqStart && dateStr <= reqEnd;
    });
  };

  // Color helper based on status
  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100";
      case "completed":
        return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
      case "pending":
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-emerald-500";
      case "rejected":
        return "bg-rose-500";
      case "completed":
        return "bg-blue-500";
      case "pending":
      default:
        return "bg-amber-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved": return "Disetujui";
      case "rejected": return "Ditolak";
      case "completed": return "Selesai";
      case "pending": default: return "Menunggu";
    }
  };

  // Month Calendar Grid Builder
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayOfMonth(currentDate);

  const monthCells = useMemo(() => {
    const cells = [];
    const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    
    // Previous month padding cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        dayNum: prevMonthDays - i,
        isCurrentMonth: false,
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i)
      });
    }

    // Current month cells
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        dayNum: i,
        isCurrentMonth: true,
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i)
      });
    }

    // Next month padding cells to fit 42 slots (6 weeks)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        dayNum: i,
        isCurrentMonth: false,
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i)
      });
    }

    return cells;
  }, [currentDate, daysInMonth, firstDayIndex]);

  // Week View Calculations
  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    // Find Monday of the current week
    const currentDay = currentDate.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust for Sunday
    startOfWeek.setDate(currentDate.getDate() + diff);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentDate]);

  // Formatted date header
  const headerLabel = useMemo(() => {
    if (view === "month") {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (view === "week") {
      const first = weekDays[0];
      const last = weekDays[6];
      if (first.getMonth() === last.getMonth()) {
        return `${monthNames[first.getMonth()]} ${first.getFullYear()}`;
      } else if (first.getFullYear() === last.getFullYear()) {
        return `${monthNames[first.getMonth()]} - ${monthNames[last.getMonth()]} ${first.getFullYear()}`;
      } else {
        return `${monthNames[first.getMonth()]} ${first.getFullYear()} - ${monthNames[last.getMonth()]} ${last.getFullYear()}`;
      }
    } else {
      return `${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  }, [view, currentDate, weekDays]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="calendar-container">
      {/* Calendar Header Control Bar */}
      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200" id="calendar-header-bar">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center text-blue-600">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{headerLabel}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Jadwal Penggunaan Kendaraan Operasional SCB</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Today and Nav Arrows */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-xs rounded-md transition-all cursor-pointer"
            >
              Hari Ini
            </button>
            <div className="h-4 w-[1px] bg-slate-300 mx-1"></div>
            <button
              onClick={() => handleNavigate(-1)}
              className="p-1 px-2 hover:bg-white hover:shadow-xs rounded-md text-slate-600 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleNavigate(1)}
              className="p-1 px-2 hover:bg-white hover:shadow-xs rounded-md text-slate-600 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View Toggles */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize cursor-pointer ${
                  view === v
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {v === "month" ? "Bulanan" : v === "week" ? "Mingguan" : "Harian"}
              </button>
            ))}
          </div>

          {onAddRequest && (
            <button
              onClick={onAddRequest}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-lg shadow-sm hover:bg-blue-750 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajukan Kendaraan
            </button>
          )}
        </div>
      </div>

      {/* View Contenders */}
      <div className="p-4" id="calendar-body">
        {/* MONTH VIEW */}
        {view === "month" && (
          <div className="w-full">
            {/* Days of Week Row */}
            <div className="grid grid-cols-7 border-b border-slate-100 text-center pb-2 text-[10px] font-bold text-slate-450 uppercase tracking-widest">
              {dayNamesShort.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Grid Days */}
            <div className="grid grid-cols-7 grid-rows-6 gap-px bg-slate-200 mt-2 rounded-lg overflow-hidden border border-slate-200">
              {monthCells.map((cell, idx) => {
                const dayRequests = getRequestsForDate(
                  cell.date.getFullYear(),
                  cell.date.getMonth(),
                  cell.date.getDate()
                );

                const isToday = 
                  new Date().getDate() === cell.date.getDate() &&
                  new Date().getMonth() === cell.date.getMonth() &&
                  new Date().getFullYear() === cell.date.getFullYear();

                return (
                  <div
                    key={idx}
                    className={`min-h-[105px] bg-white p-2 flex flex-col justify-between transition-all ${
                      cell.isCurrentMonth ? "" : "bg-slate-50/70 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-slate-700 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? "bg-blue-600 text-white shadow-xs" : ""
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {dayRequests.length > 0 && cell.isCurrentMonth && (
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                          {dayRequests.length} Pinjam
                        </span>
                      )}
                    </div>

                    {/* Request List inside Day Cell */}
                    <div className="mt-1 space-y-1 flex-1 overflow-y-auto max-h-[70px] custom-scrollbar scrollbar-none">
                      {cell.isCurrentMonth &&
                        dayRequests.slice(0, 3).map((req) => (
                          <div
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            className={`p-1 text-[10px] rounded-md border truncate font-medium cursor-pointer transition-all ${getStatusColor(
                              req.status
                            )}`}
                            title={`${req.vehicleName} - ${req.pic}`}
                          >
                            <span className="font-semibold">{req.startTime}</span> {req.vehicleName}
                          </div>
                        ))}
                      {cell.isCurrentMonth && dayRequests.length > 3 && (
                        <div className="text-[9px] text-slate-500 font-semibold pl-1 text-center">
                          + {dayRequests.length - 3} lainnya
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WEEK VIEW */}
        {view === "week" && (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[700px] grid grid-cols-7 gap-2">
              {weekDays.map((day, idx) => {
                const dayRequests = getRequestsForDate(
                  day.getFullYear(),
                  day.getMonth(),
                  day.getDate()
                );
                
                const isToday = 
                  new Date().getDate() === day.getDate() &&
                  new Date().getMonth() === day.getMonth() &&
                  new Date().getFullYear() === day.getFullYear();

                return (
                  <div
                    key={idx}
                    className={`border border-slate-100 rounded-xl bg-slate-50/30 p-3 min-h-[400px] flex flex-col ${
                      isToday ? "ring-2 ring-blue-500 bg-blue-50/10 border-blue-200" : ""
                    }`}
                  >
                    <div className="text-center border-b border-slate-100 pb-2 mb-3">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {dayNamesShort[day.getDay()]}
                      </span>
                      <span
                        className={`inline-block text-lg font-bold w-8 h-8 rounded-full text-slate-700 leading-8 ${
                          isToday ? "bg-blue-600 text-white" : ""
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto max-h-[340px] custom-scrollbar">
                      {dayRequests.length === 0 ? (
                        <div className="text-[10px] text-slate-400 text-center py-8">
                          Tidak ada jadwal
                        </div>
                      ) : (
                        dayRequests.map((req) => (
                          <div
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            className={`p-2 rounded-xl border cursor-pointer text-left transition-all text-xs font-medium ${getStatusColor(
                              req.status
                            )}`}
                          >
                            <div className="font-bold truncate text-[11px]">
                              {req.vehicleName}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-1">
                              <Clock className="w-3 h-3" />
                              {req.startTime} - {req.endTime}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-0.5">
                              <User className="w-3 h-3" />
                              {req.pic}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DAY VIEW */}
        {view === "day" && (
          <div className="w-full">
            <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse"></span>
                Jadwal Hari {dayNamesFull[currentDate.getDay()]}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {currentDate.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>

            {/* List entries */}
            <div className="space-y-3">
              {getRequestsForDate(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate()
              ).length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-12 text-center text-slate-400 text-sm font-medium">
                  Belum ada pengajuan kendaraan operasional yang dijadwalkan pada hari ini.
                </div>
              ) : (
                getRequestsForDate(
                  currentDate.getFullYear(),
                  currentDate.getMonth(),
                  currentDate.getDate()
                ).map((req) => (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-xs transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      {/* Left time ribbon */}
                      <div className="p-3 bg-slate-50 text-center rounded-xl min-w-[70px] border border-slate-100">
                        <span className="block text-xs font-bold text-blue-600">{req.startTime}</span>
                        <span className="block text-[10px] text-slate-400">s/d {req.endTime}</span>
                      </div>

                      {/* Main details */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-800 text-sm md:text-base">{req.vehicleName}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(req.status)}`}>
                            {getStatusLabel(req.status)}
                          </span>
                        </div>
                        <p className="text-slate-600 text-xs md:text-sm mt-1 font-medium italic">
                          "{req.activity}"
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            PIC: {req.pic}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            Ke: {req.destination}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {req.passengerCount} Penumpang
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all">
                        <Info className="w-3.5 h-3.5" /> Detail
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETAIL EVENT */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="request-detail-modal">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-xl overflow-hidden border border-blue-50 animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-blue-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${getStatusIndicator(selectedRequest.status)}`}></span>
                <h3 className="font-bold text-slate-800 text-lg">Detail Penggunaan Kendaraan</h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-all text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Kendaraan</span>
                  <p className="font-bold text-slate-700">{selectedRequest.vehicleName}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Penanggung Jawab</span>
                  <p className="font-bold text-slate-700">{selectedRequest.pic}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Waktu Penggunaan</span>
                <p className="text-slate-700 font-semibold text-sm">
                  {selectedRequest.startDate === selectedRequest.endDate 
                    ? `${selectedRequest.startDate} (${selectedRequest.startTime} - ${selectedRequest.endTime})`
                    : `${selectedRequest.startDate} (${selectedRequest.startTime}) s/d ${selectedRequest.endDate} (${selectedRequest.endTime})`}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Kegiatan</span>
                <p className="text-slate-700 text-sm font-medium mt-1 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {selectedRequest.activity}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tujuan</span>
                  <p className="text-slate-700 text-sm font-semibold mt-1">{selectedRequest.destination}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Jumlah Penumpang</span>
                  <p className="text-slate-700 text-sm font-semibold mt-1">{selectedRequest.passengerCount} orang</p>
                </div>
              </div>

              {selectedRequest.passengers && selectedRequest.passengers.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Daftar Penumpang</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRequest.passengers.map((passenger, idx) => (
                      <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-100 text-xs px-2.5 py-1 rounded-full font-medium">
                        {passenger}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRequest.additionalNotes && (
                <div className="border-t border-slate-100 pt-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Keterangan Tambahan</span>
                  <p className="text-slate-600 text-xs mt-1 italic">{selectedRequest.additionalNotes}</p>
                </div>
              )}

              {selectedRequest.status === "rejected" && selectedRequest.rejectionReason && (
                <div className="border-t border-rose-100 pt-4 bg-rose-50/50 p-4 rounded-2xl border">
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">Alasan Penolakan</span>
                  <p className="text-rose-700 text-xs font-semibold mt-1">{selectedRequest.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-blue-50 flex justify-end">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-5 py-2.5 bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs hover:bg-slate-750 transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
