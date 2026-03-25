/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  BellRing,
  Calendar, 
  MapPin, 
  AlertCircle, 
  Coffee, 
  Search, 
  ChevronRight, 
  CheckCircle2,
  ExternalLink,
  Info,
  ShieldAlert,
  Database,
  Navigation,
  Loader2,
  Clock,
  XCircle,
  Activity,
  Globe,
  Phone,
  Clock3,
  Tag,
  X,
  ShieldCheck,
  MessageSquareWarning,
  Zap,
  Cpu
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { findNearbyDMVs, DMVLocation } from './services/geminiService';
import { Analytics } from '@vercel/analytics/react';

const waitTimeData = [
  { time: '08:00', wait: 15 },
  { time: '10:00', wait: 45 },
  { time: '12:00', wait: 75 },
  { time: '14:00', wait: 60 },
  { time: '16:00', wait: 30 },
  { time: '18:00', wait: 20 },
];

export default function App() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [selectedType, setSelectedType] = useState('First Driver\'s License');
  const [isLoading, setIsLoading] = useState(false);
  const [locations, setLocations] = useState<DMVLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'distance'>('date');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60); // seconds
  const [nextSyncIn, setNextSyncIn] = useState(60);
  const [selectedLocation, setSelectedLocation] = useState<DMVLocation | null>(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetZip, setTargetZip] = useState('');
  const [radius, setRadius] = useState('25');
  const [targetType, setTargetType] = useState("First Driver's License");
  const [isNotificationSubscribed, setIsNotificationSubscribed] = useState(false);
  const [isActivatingAlert, setIsActivatingAlert] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Monitoring Effect for Alerts
  useEffect(() => {
    if (isNotificationSubscribed && locations.length > 0) {
      const matches = locations.filter(loc => {
        if (loc.status !== 'available' || !loc.nextAvailable) return false;
        
        const locDate = new Date(loc.nextAvailable);
        const targetD = new Date(targetDate);
        const distance = loc.distanceValue || 999;
        
        // Check if date is on or before target, and distance is within radius
        return locDate <= targetD && distance <= parseInt(radius);
      });

      if (matches.length > 0) {
        const bestMatch = matches[0];
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("DMV Slot Found!", {
            body: `A ${targetType} slot is available at ${bestMatch.name} on ${new Date(bestMatch.nextAvailable!).toLocaleDateString()}.`,
            tag: 'dmv-alert'
          });
        }
      }
    }
  }, [locations, isNotificationSubscribed, targetDate, radius, targetType]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const appointmentTypes = [
    "First Driver's License",
    "Level 1 (Learner's Permit)",
    "Level 2 (Provisional License)",
    "Level 3 (Full Provisional License)",
    "Renewal",
    "Real ID",
    "Road Test",
    "Knowledge Test",
    "Vehicle Registration",
    "Title Transfer"
  ];

  const sortedLocations = [...locations].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = a.nextAvailable ? new Date(a.nextAvailable).getTime() : Infinity;
      const dateB = b.nextAvailable ? new Date(b.nextAvailable).getTime() : Infinity;
      return dateA - dateB;
    }
    if (sortBy === 'distance') {
      return (a.distanceValue || 0) - (b.distanceValue || 0);
    }
    return a.name.localeCompare(b.name);
  });

  const handleSearch = async (e?: React.FormEvent, isBackground = false) => {
    if (e) e.preventDefault();
    if (!zipCode && !navigator.geolocation) return;

    if (!isBackground) setIsLoading(true);
    else setIsSyncing(true);
    
    setError(null);
    try {
      const results = await findNearbyDMVs(zipCode || "current location", selectedType);
      setLocations(results);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setNextSyncIn(refreshInterval);
    } catch (err) {
      if (!isBackground) setError("Failed to fetch DMV data. Please try again.");
    } finally {
      if (!isBackground) setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoRefreshEnabled && locations.length > 0) {
      timer = setInterval(() => {
        setNextSyncIn((prev) => {
          if (prev <= 1) {
            handleSearch(undefined, true);
            return refreshInterval;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, locations.length, zipCode, selectedType, refreshInterval]);

  const handleRefreshLocation = (idx: number) => {
    const newLocations = [...locations];
    newLocations[idx] = { ...newLocations[idx], status: 'checking' };
    setLocations(newLocations);
    
    setTimeout(() => {
      const updatedLocations = [...newLocations];
      updatedLocations[idx] = { 
        ...updatedLocations[idx], 
        status: Math.random() > 0.5 ? 'available' : 'booked' 
      };
      setLocations(updatedLocations);
    }, 1500);
  };

  const handleUseLocation = () => {
    if ("geolocation" in navigator) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const results = await findNearbyDMVs(`${latitude}, ${longitude}`, selectedType, latitude, longitude);
            setLocations(results);
            setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          } catch (err) {
            setError("Failed to fetch DMV data for your location.");
          } finally {
            setIsLoading(false);
          }
        },
        (err) => {
          setError("Location access denied. Please enter a zip code.");
          setIsLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      setTimeout(() => setIsSubscribed(false), 5000);
      setEmail('');
    }
  };

  return (
    <div 
      className="min-h-screen bg-void selection:bg-rose-primary/30 selection:text-rose-primary"
      onMouseMove={handleMouseMove}
      style={{ 
        ['--x' as any]: `${mousePos.x}px`, 
        ['--y' as any]: `${mousePos.y}px` 
      }}
    >
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-3.5 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between glass-card p-3.5">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-rose-primary rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(225,29,72,0.4)]">
              <Calendar className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tighter text-white leading-none">DMV<span className="text-rose-primary">.</span>VOID</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-rose-primary animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                <span className={`text-[8px] font-bold uppercase tracking-[0.2em] ${isSyncing ? 'text-rose-primary' : 'text-emerald-500/80'}`}>
                  {isSyncing ? 'Synchronizing...' : 'Network Live'}
                </span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-10">
            {['Appointments', 'Alerts', 'About'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 hover:text-rose-primary transition-all duration-300">
                {item}
              </a>
            ))}
          </div>
          <button 
            onClick={() => setIsNotificationModalOpen(true)}
            className="btn-secondary !p-3.5 text-[10px] uppercase tracking-[0.2em] group/notify"
          >
            <Bell className="w-3.5 h-3.5 text-rose-primary group-hover:scale-110 transition-transform" strokeWidth={1.5} />
            Notifications
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-3.5 pt-32 pb-24">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* Hero & Search (Large Card) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-12 glass-card p-3.5 flex flex-col justify-center relative overflow-hidden group"
          >
            <div className="spotlight" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-rose-primary mb-6 block">Intelligence Layer 01</span>
              <h1 className="text-6xl lg:text-8xl font-bold mb-8 leading-[0.85] tracking-[-0.04em]">
                Secure Your <br />
                <span className="text-rose-primary">DMV</span> Appointment.
              </h1>
              <p className="text-zinc-500 text-lg mb-12 max-w-md leading-relaxed font-medium">
                Automated monitoring for DMV cancellations. We scan official portals every minute so you don't have to.
              </p>

              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-[1.5] relative group/input">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 group-focus-within/input:text-rose-primary transition-colors" strokeWidth={1.5} />
                  <input 
                    type="text" 
                    placeholder="Enter Zip Code" 
                    className="w-full pl-12 pr-3.5 py-3.5 font-medium"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <select 
                    className="w-full py-3.5 appearance-none cursor-pointer font-medium"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    {appointmentTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="btn-primary !p-3.5 group/btn relative overflow-hidden"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left - rect.width / 2;
                    const y = e.clientY - rect.top - rect.height / 2;
                    e.currentTarget.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = `translate(0px, 0px)`;
                  }}
                >
                  {/* Lighter color version layer */}
                  <div className="absolute inset-0 bg-rose-400/10 group-hover/btn:bg-rose-400/30 transition-colors" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] transition-transform" />
                  <div className="relative z-10 flex items-center gap-2">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : <Search className="w-5 h-5 group-hover/btn:scale-110 transition-transform" strokeWidth={1.5} />}
                    <span className="uppercase tracking-widest text-xs">Search</span>
                  </div>
                </button>
              </form>
              
              <button 
                onClick={handleUseLocation}
                className="mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 hover:text-rose-primary transition-colors w-fit"
              >
                <Navigation className="w-3 h-3" strokeWidth={1.5} />
                Use Current Geolocation
              </button>
            </div>
          </motion.div>

          {/* Stats Card (Small) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="col-span-12 md:col-span-6 glass-card p-3.5 flex flex-col justify-between group overflow-hidden cursor-pointer"
            onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
          >
            <div className="spotlight" />
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-rose-primary/10 rounded-full blur-3xl group-hover:bg-rose-primary/20 transition-all duration-700" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-12">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/[0.05] group-hover:border-rose-primary/20 transition-colors">
                  <Clock className={`w-6 h-6 text-rose-primary ${isAutoRefreshEnabled ? 'animate-[spin_10s_linear_infinite]' : ''}`} strokeWidth={1.5} />
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 block mb-1">Auto-Sync</span>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isAutoRefreshEnabled ? 'text-emerald-500' : 'text-rose-primary'}`}>
                    {isAutoRefreshEnabled ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-6xl font-bold text-white tracking-tighter">{nextSyncIn}s</span>
                  <span className="text-[10px] font-bold text-rose-primary uppercase tracking-[0.3em]">Next Sync</span>
                </div>
                <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden mb-4">
                  <motion.div 
                    className="h-full bg-rose-primary"
                    initial={{ width: "100%" }}
                    animate={{ width: `${(nextSyncIn / refreshInterval) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed font-medium">
                  {isAutoRefreshEnabled 
                    ? `Synchronizing with DMV nodes every ${refreshInterval} seconds.` 
                    : "Auto-sync paused. Click to resume real-time monitoring."}
                </p>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-white/[0.03] flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isAutoRefreshEnabled ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse' : 'bg-zinc-800'}`} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  {isAutoRefreshEnabled ? 'All Nodes Operational' : 'Standby Mode'}
                </span>
              </div>
              <div className="flex gap-2">
                {[30, 60, 120].map(val => (
                  <button 
                    key={val}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRefreshInterval(val);
                      setNextSyncIn(val);
                    }}
                    className={`text-[8px] font-bold px-2 py-1 rounded-xl border transition-all ${refreshInterval === val ? 'bg-rose-primary/20 border-rose-primary/40 text-rose-primary' : 'bg-white/[0.02] border-white/[0.05] text-zinc-600 hover:text-zinc-400'}`}
                  >
                    {val}s
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Node Intelligence (New Card) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="col-span-12 md:col-span-6 glass-card p-3.5 group overflow-hidden"
          >
            <div className="spotlight" />
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center justify-between mb-12">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/[0.05] group-hover:border-rose-primary/20 transition-colors">
                  <Zap className="w-6 h-6 text-rose-primary" strokeWidth={1.5} />
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 block mb-1">Node Intelligence</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">System Health & Latency</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600 block mb-2">Latency</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white tracking-tighter">42</span>
                    <span className="text-[10px] font-bold text-rose-primary uppercase tracking-widest">ms</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600 block mb-2">Uptime</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white tracking-tighter">99.9</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">%</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex-1">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Active Nodes</span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500">12/12 Online</span>
                </div>
                <div className="flex gap-1.5">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="flex-1 h-8 rounded-md bg-emerald-500/20 border border-emerald-500/30 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3 h-3 text-zinc-600" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Core Engine v2.4.0</span>
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-800">Stable</span>
              </div>
            </div>
          </motion.div>

          {/* Tactical Map (New Visualization) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-12 glass-card p-3.5 group overflow-hidden"
          >
            <div className="spotlight" />
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.02] flex items-center justify-center border border-white/[0.05]">
                    <Globe className="w-5 h-5 text-rose-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Tactical Map View</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-600">Spatial Node Distribution</span>
                      {isSyncing && (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-[8px] font-bold uppercase tracking-[0.2em] text-rose-primary flex items-center gap-1"
                        >
                          <Loader2 className="w-2 h-2 animate-spin" />
                          Updating...
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                  <div className="flex items-center gap-2 px-3 border-r border-white/[0.05] mr-2">
                    <button 
                      onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
                      className={`w-8 h-4 rounded-full relative transition-colors p-4 ${isAutoRefreshEnabled ? 'bg-rose-primary' : 'bg-zinc-800'}`}
                    >
                      <motion.div 
                        animate={{ x: isAutoRefreshEnabled ? 18 : 2 }}
                        className="absolute top-1 w-2 h-2 rounded-full bg-white shadow-sm"
                      />
                    </button>
                    <select 
                      value={refreshInterval}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRefreshInterval(val);
                        setNextSyncIn(val);
                      }}
                      className="bg-transparent text-[7px] font-bold uppercase tracking-widest text-zinc-500 border-none focus:ring-0 cursor-pointer p-4"
                    >
                      <option value="30">30s</option>
                      <option value="60">60s</option>
                      <option value="120">120s</option>
                    </select>
                  </div>
                  {['list', 'map'].map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`px-4 py-1.5 text-[8px] font-bold uppercase tracking-[0.2em] rounded-lg transition-all ${activeTab === tab ? 'bg-white/[0.05] text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 relative min-h-[300px] bg-white/[0.01] rounded-2xl border border-white/[0.03] overflow-hidden">
                <div className="scan-line" />
                
                {/* Subtle Loading Overlay */}
                <AnimatePresence>
                  {isSyncing && (
                    <motion.div 
                      key="map-loader"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-rose-primary/[0.02] backdrop-blur-[1px] z-20 flex items-center justify-center pointer-events-none"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 rounded-full border border-rose-primary/20 border-t-rose-primary animate-spin" />
                        <span className="text-[8px] font-bold uppercase tracking-[0.4em] text-rose-primary/60">Refreshing Tactical Data</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Stylized Map Background */}
                <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 800 400">
                  <path d="M100,100 Q200,50 300,150 T500,100 T700,200" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" fill="none" />
                  <path d="M50,300 Q150,250 250,350 T450,300 T650,400" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" fill="none" />
                  <circle cx="200" cy="150" r="100" stroke="rgba(225,29,72,0.05)" strokeWidth="1" fill="none" />
                  <circle cx="600" cy="250" r="150" stroke="rgba(225,29,72,0.05)" strokeWidth="1" fill="none" />
                </svg>

                {/* Map Grid */}
                <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 opacity-10 pointer-events-none">
                  {Array.from({ length: 72 }).map((_, i) => (
                    <div key={i} className="border-[0.5px] border-white/20" />
                  ))}
                </div>

                {/* DMV Nodes */}
                <div className="absolute inset-0 p-4">
                  {locations.length > 0 ? (
                    <div className="relative w-full h-full">
                      {locations.map((loc, i) => {
                        // Deterministic but random-looking positions for the tactical map
                        const x = (i * 20 + 10) % 90;
                        const y = (i * 30 + 20) % 80;
                        return (
                          <motion.div
                            key={loc.name}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="absolute group/node"
                            style={{ left: `${x}%`, top: `${y}%` }}
                          >
                            <div className="relative">
                              <div 
                                onClick={() => setSelectedLocation(loc)}
                                className={`w-3 h-3 rounded-full cursor-pointer ${loc.status === 'available' ? 'bg-emerald-500' : 'bg-rose-primary'} shadow-[0_0_15px_rgba(225,29,72,0.5)] hover:scale-150 transition-transform`} 
                              />
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover/node:opacity-100 transition-opacity whitespace-nowrap z-50">
                                <div className="glass-card px-4 py-3 border-rose-primary/20 flex flex-col gap-2 min-w-[180px]">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-white">{loc.name}</span>
                                    <div className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest ${loc.status === 'available' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-primary/10 text-rose-primary'}`}>
                                      {loc.status}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-[8px] font-medium text-zinc-500">
                                    <div className="flex items-center gap-1.5">
                                      <Navigation className="w-2.5 h-2.5 text-rose-primary/40" />
                                      {loc.distance || "Calculating..."}
                                    </div>
                                    <a 
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name + ' ' + loc.address)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-rose-primary hover:underline flex items-center gap-1"
                                    >
                                      Directions
                                      <ExternalLink className="w-2 h-2" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                              {/* Pulse Effect for available */}
                              {loc.status === 'available' && (
                                <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-20" />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-800">No Active Nodes Detected</span>
                    </div>
                  )}
                </div>

                {/* Map Overlay Text */}
                <div className="absolute bottom-4 left-4 flex items-center gap-4 p-4">
                  <div className="flex items-center gap-2 p-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-600">Available</span>
                  </div>
                  <div className="flex items-center gap-2 p-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-primary" />
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-600">Booked</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Table Card (Large) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="col-span-12 glass-card overflow-hidden group"
          >
            <div className="spotlight" />
            <div className="relative z-10">
              <div className="p-3.5 border-b border-white/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/[0.005]">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold tracking-tight">Intelligence Feed</h2>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-primary/5 border border-rose-primary/10">
                    <div className="w-1 h-1 rounded-full bg-rose-primary animate-pulse" />
                    <span className="text-[10px] font-bold text-rose-primary uppercase tracking-[0.2em]">Live</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Last Sync: {lastUpdated}</span>
                  <div className="flex bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                    {['date', 'name', 'distance'].map(type => (
                      <button 
                        key={type}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortBy(type as any);
                        }}
                        className={`p-4 text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg transition-all ${sortBy === type ? 'bg-white/[0.05] text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.005] border-b border-white/[0.03]">
                      <th className="px-3.5 py-3.5 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Location</th>
                      <th className="px-3.5 py-3.5 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Distance</th>
                      <th className="px-3.5 py-3.5 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Type</th>
                      <th className="px-3.5 py-3.5 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Status</th>
                      <th className="px-3.5 py-3.5 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Availability</th>
                      <th className="px-3.5 py-3.5 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {sortedLocations.length > 0 ? (
                      sortedLocations.map((loc, idx) => (
                        <tr 
                          key={`${loc.name}-${idx}`} 
                          className="group/row hover:bg-white/[0.005] transition-colors cursor-pointer"
                          onClick={() => setSelectedLocation(loc)}
                        >
                          <td className="px-3.5 py-3.5">
                            <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/[0.05] group-hover/row:border-rose-primary/30 transition-all duration-500">
                                <MapPin className="w-5 h-5 text-zinc-600 group-hover/row:text-rose-primary transition-colors" strokeWidth={1.5} />
                              </div>
                              <div>
                                <span className="font-bold text-white block text-base tracking-tight">{loc.name}</span>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[11px] text-zinc-600 font-medium truncate max-w-[200px]">{loc.address}</span>
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name + ' ' + loc.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] font-bold uppercase tracking-widest text-rose-primary/60 hover:text-rose-primary transition-colors"
                                  >
                                    View Map
                                  </a>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
                              <Navigation className="w-3 h-3 text-rose-primary/40" />
                              {loc.distance || "Calculating..."}
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 bg-white/[0.02] px-3 py-1 rounded-full border border-white/[0.05]">
                              {loc.type || selectedType}
                            </span>
                          </td>
                          <td className="px-3.5 py-3.5">
                            {loc.status === 'available' ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                  Available
                                </div>
                                <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest ml-3.5">Estimated</span>
                              </div>
                            ) : loc.status === 'checking' ? (
                              <div className="flex items-center gap-2 text-[10px] font-bold text-rose-primary uppercase tracking-[0.2em]">
                                <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                                Checking
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em]">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                                Booked
                              </div>
                            )
                            }
                          </td>
                          <td className="px-3.5 py-3.5">
                            <div className="flex items-center gap-3 text-white font-bold text-sm tracking-tight">
                              <Calendar className="w-4 h-4 text-rose-primary/40" strokeWidth={1.5} />
                              {loc.nextAvailable ? new Date(loc.nextAvailable).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-4">
                              <button 
                                onClick={() => handleRefreshLocation(idx)}
                                className="p-2.5 text-zinc-700 hover:text-rose-primary transition-all hover:bg-white/[0.03] rounded-xl"
                              >
                                <Loader2 className={`w-4 h-4 ${loc.status === 'checking' ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTargetZip(loc.address.split(',').pop()?.trim() || '');
                                  setIsNotificationModalOpen(true);
                                }}
                                className={`text-[10px] font-bold uppercase tracking-[0.2em] !p-3.5 rounded-xl border transition-all duration-300 flex items-center gap-2 ${loc.status === 'available' ? 'bg-rose-primary border-rose-primary text-white shadow-[0_5px_15px_-5px_rgba(225,29,72,0.4)] hover:scale-105 active:scale-95' : 'bg-white/[0.02] border-white/[0.05] text-zinc-600 hover:text-rose-primary hover:border-rose-primary/30'}`}
                              >
                                {loc.status === 'available' ? (
                                  <>Secure Slot</>
                                ) : (
                                  <>
                                    <Bell className="w-3.5 h-3.5" />
                                    Set Alert
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-32 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-3xl bg-white/[0.01] border border-white/[0.05] flex items-center justify-center mb-2">
                              <Search className="w-8 h-8 text-zinc-800" />
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-700">
                              {isLoading ? "Synchronizing with DMV Nodes..." : "Awaiting Input Parameters"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>

          {/* Alerts Card (Small) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="col-span-12 md:col-span-6 lg:col-span-6 glass-card p-3.5 flex flex-col group relative overflow-hidden"
          >
            <div className="spotlight" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-primary/5 rounded-full blur-[80px] translate-x-1/2 -translate-y-1/2" />
            
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/[0.05] mb-8 group-hover:border-rose-primary/20 transition-colors">
                <Bell className="w-6 h-6 text-rose-primary" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight">Instant Alerts</h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-10 font-medium max-w-sm">
                Receive notifications the millisecond a slot becomes available. Our low-latency network ensures you're always first in line.
              </p>
              
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  className="flex-1 text-sm py-3.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" className="btn-primary !p-3.5 text-xs uppercase tracking-widest whitespace-nowrap group/node relative overflow-hidden">
                  <div className="absolute inset-0 bg-rose-400/10 group-hover/node:bg-rose-400/30 transition-colors" />
                  <span className="relative z-10">Activate Node</span>
                </button>
              </form>
              
              <AnimatePresence>
                {isSubscribed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500"
                  >
                    <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                    Monitoring Active — Node Connected
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Disclaimer (Small) */}
          <div className="col-span-12 md:col-span-6 lg:col-span-6 glass-card p-3.5 flex flex-col justify-between border-rose-primary/5 group relative overflow-hidden">
            <div className="spotlight" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/[0.05] mb-8 group-hover:border-rose-primary/20 transition-colors">
                <ShieldAlert className="w-6 h-6 text-rose-primary/40" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white mb-4">Security Protocols</h4>
                <p className="text-[11px] text-zinc-600 leading-relaxed font-medium max-w-md">
                  VOID.DMV operates as an independent intelligence layer. We utilize public data streams and proprietary monitoring nodes. We are not affiliated with, endorsed by, or partnered with any government entity. Use of this service is subject to our terms of engagement.
                </p>
              </div>
            </div>
            <div className="mt-8 flex items-center gap-6 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-700">AES-256</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-700">SSL-SECURE</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-3.5 py-20 border-t border-white/[0.03]">
        <div className="flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-4 grayscale opacity-30 hover:opacity-100 transition-opacity duration-700">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center border border-white/[0.05]">
              <Calendar className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold tracking-[0.3em] text-white uppercase">Void<span className="text-rose-primary">.</span>Intelligence</span>
          </div>
          <div className="flex gap-12 text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-700">
            {['Privacy', 'Terms', 'API', 'Status'].map(link => (
              <a key={link} href="#" className="hover:text-rose-primary transition-colors">{link}</a>
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-800">
            © 2026 VOID.DMV — LAYER 01
          </p>
        </div>
      </footer>

      {/* Notification Setup Modal */}
      <AnimatePresence>
        {isNotificationModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationModalOpen(false)}
              className="absolute inset-0 bg-void/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass-card p-0 overflow-hidden shadow-[0_0_100px_rgba(225,29,72,0.1)]"
            >
              <div className="spotlight" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-primary/5 rounded-full blur-[80px] translate-x-1/2 -translate-y-1/2" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between p-6 border-b border-white/[0.03]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-primary/10 flex items-center justify-center border border-rose-primary/20">
                      <BellRing className="w-6 h-6 text-rose-primary" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-white">Smart Alerts</h2>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Node Activation</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsNotificationModalOpen(false)}
                    className="p-2 hover:bg-white/[0.05] rounded-xl transition-colors text-zinc-500 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  {!isNotificationSubscribed ? (
                    <>
                      <div className="space-y-4">
                        {alertError && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3"
                          >
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{alertError}</p>
                          </motion.div>
                        )}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Phone Number</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                            <input 
                              type="tel" 
                              placeholder="+1 (555) 000-0000"
                              className="w-full pl-12 pr-4 py-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white focus:outline-none focus:border-rose-primary/50 transition-colors"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Target Date</label>
                            <div className="relative">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                              <input 
                                type="date" 
                                className="w-full pl-12 pr-4 py-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white focus:outline-none focus:border-rose-primary/50 transition-colors"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Zip Code</label>
                            <div className="relative">
                              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                              <input 
                                type="text" 
                                placeholder="90210"
                                className="w-full pl-12 pr-4 py-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white focus:outline-none focus:border-rose-primary/50 transition-colors"
                                value={targetZip}
                                onChange={(e) => setTargetZip(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Appointment Type</label>
                          <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                            <select 
                              className="w-full pl-12 pr-4 py-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white focus:outline-none focus:border-rose-primary/50 transition-colors appearance-none cursor-pointer"
                              value={targetType}
                              onChange={(e) => setTargetType(e.target.value)}
                            >
                              {appointmentTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Search Radius (Miles)</label>
                          <select 
                            className="w-full px-4 py-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white focus:outline-none focus:border-rose-primary/50 transition-colors appearance-none cursor-pointer"
                            value={radius}
                            onChange={(e) => setRadius(e.target.value)}
                          >
                            <option value="10">10 Miles</option>
                            <option value="25">25 Miles</option>
                            <option value="50">50 Miles</option>
                            <option value="100">100 Miles</option>
                          </select>
                        </div>
                      </div>

                      <button 
                        disabled={isActivatingAlert}
                        onClick={async () => {
                          setAlertError(null);
                          if (!phone || !targetDate || !targetZip) {
                            setAlertError("All fields are required");
                            return;
                          }
                          
                          setIsActivatingAlert(true);
                          
                          try {
                            // Request Chrome Notification Permission
                            if ("Notification" in window) {
                              // Some browsers/iframes ignore requestPermission if not top-level
                              // We'll try it, but proceed if it fails or is denied with a warning
                              try {
                                const permission = await Notification.requestPermission();
                                if (permission !== "granted") {
                                  console.warn("Notification permission denied");
                                }
                              } catch (e) {
                                console.error("Notification request failed", e);
                              }
                            }
                            
                            // Simulate network latency for "Activating Node"
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            setIsNotificationSubscribed(true);
                          } catch (err) {
                            setAlertError("Activation failed. Please try again.");
                          } finally {
                            setIsActivatingAlert(false);
                          }
                        }}
                        className="w-full btn-primary !p-4 group/btn relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="absolute inset-0 bg-rose-400/10 group-hover/btn:bg-rose-400/30 transition-colors" />
                        <div className="relative z-10 flex items-center justify-center gap-2">
                          {isActivatingAlert ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <BellRing className="w-4 h-4" />
                          )}
                          <span className="uppercase tracking-widest text-xs">
                            {isActivatingAlert ? 'Activating Node...' : 'Activate Alerts'}
                          </span>
                        </div>
                      </button>
                    </>
                  ) : (
                    <div className="space-y-8 py-4">
                      <div className="text-center space-y-4">
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", damping: 12, stiffness: 200 }}
                          className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto"
                        >
                          <ShieldCheck className="w-10 h-10 text-emerald-500" />
                        </motion.div>
                        <div>
                          <h3 className="text-2xl font-bold text-white tracking-tight">Alert Node Active</h3>
                          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mt-1">Monitoring DMV Network</p>
                        </div>
                      </div>

                      <div className="glass-card p-6 space-y-4 bg-white/[0.02]">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Appointment</p>
                            <p className="text-sm font-bold text-white">{targetType}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Target Date</p>
                            <p className="text-sm font-bold text-white">{new Date(targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Location</p>
                            <p className="text-sm font-bold text-white">{targetZip} ({radius}mi)</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Contact</p>
                            <p className="text-sm font-bold text-white">{phone}</p>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t border-white/[0.03] flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">Real-time synchronization enabled</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[10px] text-center text-zinc-500 font-medium px-6">
                          We'll push a notification to your browser and send an SMS as soon as a slot matching your criteria is detected.
                        </p>
                        <button 
                          onClick={() => {
                            setIsNotificationModalOpen(false);
                            setIsNotificationSubscribed(false);
                          }}
                          className="btn-secondary !p-4 w-full text-[10px] uppercase tracking-[0.2em]"
                        >
                          Return to Terminal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Location Details Modal */}
      <AnimatePresence>
        {selectedLocation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLocation(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass-card p-0 overflow-hidden"
            >
              <div className="spotlight" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-primary/5 rounded-full blur-[80px] translate-x-1/2 -translate-y-1/2" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between p-3.5 border-b border-white/[0.03]">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/[0.05]">
                      <MapPin className="w-6 h-6 text-rose-primary" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-white">{selectedLocation.name}</h2>
                      <p className="text-sm text-zinc-500 font-medium">{selectedLocation.address}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedLocation(null)}
                    className="p-2 hover:bg-white/[0.05] rounded-xl transition-colors text-zinc-500 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-8">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <Clock3 className="w-4 h-4 text-rose-primary/60" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Operating Hours</span>
                      </div>
                      <p className="text-white font-medium">{selectedLocation.hours || "Mon-Fri: 8:00 AM - 5:00 PM"}</p>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <Phone className="w-4 h-4 text-rose-primary/60" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Contact Number</span>
                      </div>
                      <p className="text-white font-medium">{selectedLocation.phone || "(555) 000-0000"}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <Calendar className="w-4 h-4 text-rose-primary/60" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Next Available Slot</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-white">
                          {selectedLocation.nextAvailable ? new Date(selectedLocation.nextAvailable).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </span>
                        <div className="flex flex-col items-start">
                          <div className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${selectedLocation.status === 'available' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-primary/10 text-rose-primary border border-rose-primary/20'}`}>
                            {selectedLocation.status}
                          </div>
                          {selectedLocation.lastVerified && (
                            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-1 ml-1">{selectedLocation.lastVerified}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <Tag className="w-4 h-4 text-rose-primary/60" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Services Offered</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(selectedLocation.services || ["Driver's License", "Registration", "ID Cards", "Road Tests", "Knowledge Tests"]).map((service, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Using a more subtle feedback instead of alert
                          console.log("Data accuracy report received.");
                        }}
                        className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-700 hover:text-rose-primary transition-colors group/report"
                      >
                        <MessageSquareWarning className="w-3.5 h-3.5 group-hover/report:scale-110 transition-transform" strokeWidth={1.5} />
                        Report Inaccurate Data
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-white/[0.01] border-t border-white/[0.03] flex items-center justify-between">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLocation.name + ' ' + selectedLocation.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-rose-primary transition-colors flex items-center gap-2"
                  >
                    <Navigation className="w-3 h-3" />
                    Get Directions
                  </a>
                  <a 
                    href={selectedLocation.bookingUrl || "#"} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`text-[10px] font-bold uppercase tracking-[0.2em] !p-3.5 rounded-xl border transition-all duration-300 ${selectedLocation.status === 'available' ? 'bg-rose-primary border-rose-primary text-white shadow-[0_5px_15px_-5px_rgba(225,29,72,0.4)] hover:scale-105 active:scale-95' : 'bg-transparent border-white/[0.05] text-zinc-800 cursor-not-allowed'}`}
                  >
                    {selectedLocation.status === 'available' ? 'Secure Appointment' : 'Join Waitlist'}
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Analytics />
    </div>
  );
}
