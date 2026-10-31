import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, BusFront, Check, Clock3, MapPin, Navigation, Send, Users } from 'lucide-react';
import { api, levelText } from '../api';
import TransitMap from '../components/TransitMap';
import type { Transit } from '../useTransit';
import type { Arrival } from '../types';

export default function Passenger({ transit, selectedRoute, setRoute, selectedStop, setStop }: {
  transit: Transit; selectedRoute: number; setRoute: (id: number) => void; selectedStop: number; setStop: (id: number) => void;
}) {
  const { routes, stops, buses, density, revision } = transit;
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportBus, setReportBus] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const route = routes.find(r => r.id === selectedRoute);
  const routeStops = stops[selectedRoute] || [];
  const routeBuses = buses.filter(b => b.route_id === selectedRoute);
  const currentDensity = density.find(d => d.route_id === selectedRoute);
  useEffect(() => { setReportBus(0); setNotice(''); }, [selectedRoute]);
  useEffect(() => {
    let active = true;
    setLoading(true); setArrivals([]);
    async function load() {
      try {
        const data = await api<Arrival[]>(`/stops/${selectedStop}/arrivals`);
        if (active) { setArrivals(data.filter(a => a.route_id === selectedRoute)); setError(''); }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'ETA yüklənmədi.'); }
      finally { if (active) setLoading(false); }
    }
    void load(); const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [selectedStop, selectedRoute, revision]);
  async function report(level: number) {
    setSending(true); setNotice('');
    try {
      await api('/crowd-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ route_id: selectedRoute, bus_id: reportBus || routeBuses[0]?.id, level }) });
      setNotice('Hesabatınız qəbul edildi. Sıxlıq növbəti dəqiqə ərzində yenilənəcək.');
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Hesabat göndərilmədi.'); }
    finally { setSending(false); }
  }
  return <>
    <div className="page-title"><div><div className="eyebrow">SƏRNİŞİN PANELİ</div><h1>Şəhər hərəkətdədir<span>.</span></h1><p>Avtobusunuzu tapın, vaxtınızı rahat planlaşdırın.</p></div><div className="location-tag"><MapPin size={15}/> Bakı <span>AZ</span></div></div>
    <div className="route-tabs" aria-label="Marşrut seçimi">{routes.map(r => {
      const d = density.find(d => d.route_id === r.id);
      return <button key={r.id} onClick={() => setRoute(r.id)} className={`route-tab ${selectedRoute === r.id ? 'selected' : ''}`} aria-pressed={selectedRoute === r.id}><span className="route-symbol" style={{ backgroundColor: `${r.color}15`, color: r.color }}><BusFront size={19}/></span><span><strong>{r.code}</strong><small>{r.name.replace(' (demo)', '')}</small></span><span className={`tiny-dot ${d && d.confidence !== 'unavailable' ? d.level : 'unknown'}`}/></button>;
    })}</div>
    <div className="passenger-layout"><div className="passenger-main"><TransitMap routes={routes} stops={stops} buses={buses} density={density} selectedRoute={selectedRoute} selectedStop={selectedStop} onStop={setStop}/><div className="help-strip"><span className="help-icon"><Navigation size={19}/></span><div><strong>Birlikdə daha rahat səfərlər</strong><p>Sıxlıq hesabatınız digər sərnişinlərə doğru seçim etməyə kömək edir.</p></div><ArrowUpRight size={20}/></div></div>
      <aside className="journey-column"><section className="card journey-card"><div className="section-title"><h2>Səfərinizi planlaşdırın</h2><span className="soft-icon"><Navigation size={17}/></span></div><label htmlFor="stop-select" className="field-label">DAYANACAQ SEÇİN</label><div className="select-wrap"><MapPin size={18}/><select id="stop-select" value={selectedStop} onChange={event => setStop(Number(event.target.value))}>{routes.map(r => <optgroup key={r.id} label={`${r.code} · ${r.name}`}>{(stops[r.id] || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}</select></div>
        <div className="route-journey"><div className="journey-track"><i/><span/><MapPin size={14}/></div><div><span>Seçilmiş marşrut</span><strong>{route?.name.replace(' (demo)', '')}</strong><small>{routeStops.length} dayanacaq <ArrowDown size={11}/> {route?.code}</small></div></div>
        <div className="density-note"><Users size={16}/><span>Marşrutda sıxlıq</span><span className={`badge ${currentDensity && currentDensity.confidence !== 'unavailable' ? currentDensity.level : 'unknown'}`}>{levelText[currentDensity && currentDensity.confidence !== 'unavailable' ? currentDensity.level : 'unknown']}</span></div>
      </section><section className="card arrivals-card"><div className="section-title"><h2>Yaxınlaşan avtobuslar</h2><Clock3 size={17}/></div><p className="section-caption">Seçilmiş dayanacağa təxmini çatma vaxtı</p>
        {error && <p role="alert" className="inline-error">{error}</p>}{loading ? <div className="empty-state">Gəliş vaxtları yüklənir…</div> : arrivals.length ? arrivals.map((a, index) => <div className="arrival-item" key={a.bus_id}><span className={`arrival-icon ${index === 0 ? 'next' : ''}`}><BusFront size={21}/></span><div className="arrival-detail"><strong>{route?.code}<small> · {a.plate}</small></strong><span className={`crowd-label ${a.crowd_level}`}><i/>{levelText[a.crowd_level]}</span></div><div className="eta"><strong>{Math.ceil(a.eta_minutes)}</strong><span>dəqiqə</span></div></div>) : <div className="empty-state"><Clock3 size={24}/><p>Hazırda yaxınlaşan avtobus yoxdur.</p><small>Mövqelər yeniləndikcə gəlişlər görünəcək.</small></div>}
        <div className="arrival-footnote"><i/>GPS əsasında · hər 10 saniyədə yenilənir</div></section></aside>
      <section className="card report-card"><div className="report-copy"><span className="soft-icon"><Users size={21}/></span><div><h2>Avtobusda vəziyyət necədir?</h2><p>Bir toxunuşla sıxlığı bildirin.</p></div></div><label className="sr-only" htmlFor="report-bus">Hesabat üçün avtobus</label><select id="report-bus" className="bus-select" value={reportBus || routeBuses[0]?.id || ''} onChange={event => setReportBus(Number(event.target.value))}>{routeBuses.map(b => <option key={b.id} value={b.id}>{b.plate}</option>)}</select>
        <div className="report-buttons">{[{ level: 1, text: 'Boş', className: 'low', icon: <Check size={18}/> }, { level: 3, text: 'Orta', className: 'medium', icon: <Users size={18}/> }, { level: 5, text: 'Dolu', className: 'high', icon: <BusFront size={18}/> }].map(item => <button key={item.level} className={item.className} disabled={sending || !routeBuses.length} onClick={() => void report(item.level)}>{item.icon}{item.text}</button>)}</div>{notice && <div className="report-notice" role="status"><Send size={14}/>{notice}</div>}
      </section></div>
  </>;
}
