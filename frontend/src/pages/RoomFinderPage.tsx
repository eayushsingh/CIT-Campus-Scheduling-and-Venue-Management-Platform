import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Sparkles,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

interface RoomItem {
  id: string;
  name: string;
  type: string;
  capacity: number;
  floor: number;
  features?: string[];
  allowed_uses?: string[];
}

export const RoomFinderPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [day, setDay] = useState<string>('MON');
  const [period, setPeriod] = useState<number>(3);
  const [duration, setDuration] = useState<number>(1);
  const [capacity, setCapacity] = useState<number>(40);
  const [roomType, setRoomType] = useState<string>('all');
  const [accessible, setAccessible] = useState<boolean>(false);

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const searchRooms = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/bookings/available-rooms', {
        params: {
          day,
          period,
          capacity,
          room_type: roomType,
          accessible_only: accessible,
        },
      });
      setRooms(res.data?.available_rooms || []);
    } catch {
      showToast('Failed to load free rooms.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchRooms();
  }, [day, period, capacity, roomType, accessible]);

  // Determine "Best Fit": Smallest room that meets capacity
  const bestFitRoomId = rooms.length > 0
    ? [...rooms]
        .filter((r) => r.capacity >= capacity)
        .sort((a, b) => a.capacity - b.capacity)[0]?.id
    : null;

  const handleBookRoom = (r: RoomItem) => {
    navigate('/bookings', {
      state: {
        prefillRoom: r.id,
        prefillDay: day,
        prefillPeriod: period,
        prefillDuration: duration,
        prefillCapacity: capacity,
        prefillType: r.type,
      },
    });
    showToast(`Selected ${r.id} (${r.name}). Complete booking details below.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Campus Room Finder</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Instant clash-free venue discovery with automatic "Best Fit" optimization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 px-3.5 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold">
          <Zap className="w-4 h-4 text-emerald-600" />
          <span>Real-time Timetable & Booking Check</span>
        </div>
      </div>

      {/* Filter Matrix Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span>Search Constraints</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Day</label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="w-full text-sm rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              {Array.from({ length: 13 }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  P{p} ({p <= 5 ? `${7 + p}:00` : p <= 9 ? `${8 + p}:00` : `${9 + p}:00`})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full text-sm rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value={1}>1 Period (1 hr)</option>
              <option value={2}>2 Periods (2 hrs)</option>
              <option value={3}>3 Periods (3 hrs)</option>
              <option value={4}>4 Periods (4 hrs)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Min Capacity</label>
            <input
              type="number"
              min={1}
              max={1500}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full text-sm rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Room Type</label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Room Types</option>
              <option value="classroom">Classroom</option>
              <option value="lecture_hall">Lecture Hall</option>
              <option value="auditorium">Auditorium</option>
              <option value="seminar_hall">Seminar Hall</option>
              <option value="lab_cs">CS Lab</option>
              <option value="lab_elec">Electronics Lab</option>
              <option value="lab_phy">Physics Lab</option>
              <option value="lab_civil">Civil Lab</option>
              <option value="workshop">Workshop</option>
              <option value="outdoor">Outdoor Amphitheatre</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition min-h-[44px]">
              <input
                type="checkbox"
                checked={accessible}
                onChange={(e) => setAccessible(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="text-xs font-medium text-slate-700">Accessible Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Available Rooms Grid */}
      {loading ? (
        <LoadingSpinner label="Checking room occupancy against weekly timetable..." />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="No Matching Rooms Available"
          description="All rooms fitting these criteria are either occupied or under maintenance. Try shifting the period or day."
          icon={<Building2 className="w-8 h-8 text-slate-400" />}
          actionLabel="Reset to Monday P3"
          onAction={() => {
            setDay('MON');
            setPeriod(3);
            setCapacity(30);
            setRoomType('all');
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>FOUND {rooms.length} AVAILABLE ROOMS</span>
            <span className="text-emerald-700">Sorted by best capacity utilization</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rooms.map((r) => {
              const isBestFit = r.id === bestFitRoomId;
              return (
                <div
                  key={r.id}
                  className={`bg-white p-5 rounded-2xl border transition relative flex flex-col justify-between ${
                    isBestFit
                      ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md'
                      : 'border-slate-200 shadow-sm hover:border-slate-300'
                  }`}
                >
                  {isBestFit && (
                    <div className="absolute -top-2.5 right-4 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1 shadow-sm">
                      <Sparkles className="w-3 h-3" />
                      <span>BEST FIT</span>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h2 className="font-bold text-slate-900 text-lg leading-snug">{r.id}</h2>
                        <p className="text-xs text-slate-500">{r.name}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        Floor {r.floor}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 my-4 border-t border-b border-slate-100 py-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Room Type:</span>
                        <span className="font-medium capitalize">{r.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Capacity:</span>
                        <span className="font-bold text-slate-900">{r.capacity} seats</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Accessibility:</span>
                        <span className="font-medium text-emerald-700">
                          {r.floor === 1 ? 'Ground Floor (Wheelchair Accessible)' : 'Upper Floor'}
                        </span>
                      </div>

                      {r.features && r.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {r.features.map((f) => (
                            <span key={f} className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleBookRoom(r)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2 min-h-[44px] ${
                      isBestFit
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <span>Reserve this Room</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
