import { Area, AreaChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { timeLabel } from '../api';
import type { Density, Forecast } from '../types';

export function DensityChart({ history }: { history: Density[] }) {
  if (!history.length) return <div className="chart-empty">Hələ sıxlıq tarixçəsi yoxdur.</div>;
  return <div className="chart-wrap" role="img" aria-label="Marşrut üzrə son saatın sıxlıq qrafiki"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history.map(d => ({ ...d, time: timeLabel(d.ts) }))} margin={{ left: -25, right: 8, top: 12, bottom: 0 }}>
    <defs><linearGradient id="densityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#168c89" stopOpacity={0.25}/><stop offset="100%" stopColor="#168c89" stopOpacity={0.01}/></linearGradient></defs>
    <CartesianGrid vertical={false} stroke="#e9eeec" strokeDasharray="3 3"/><XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={11} minTickGap={35}/><YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11}/>
    <Tooltip formatter={(value) => [`${value}/100`, 'Sıxlıq']} contentStyle={{ borderRadius: 12, border: '1px solid #e5ece9', fontSize: 12 }}/><Area type="monotone" dataKey="score" stroke="#168c89" strokeWidth={2.5} fill="url(#densityFill)"/>
  </AreaChart></ResponsiveContainer></div>;
}
export function ForecastChart({ forecast }: { forecast: Forecast | null }) {
  if (!forecast) return <div className="chart-empty">Proqnoz yüklənir…</div>;
  return <div className="chart-wrap forecast-chart" role="img" aria-label="Növbəti 60 dəqiqə üçün sıxlıq proqnozu"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={forecast.points.map(d => ({ ...d, time: timeLabel(d.ts) }))} margin={{ left: -25, right: 8, top: 12, bottom: 0 }}>
    <CartesianGrid vertical={false} stroke="#e9eeec" strokeDasharray="3 3"/><XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={11}/><YAxis domain={[0, 100]} axisLine={false} tickLine={false} fontSize={11}/><Tooltip formatter={(value) => [`${value}/100`, 'Proqnoz']} contentStyle={{ borderRadius: 12, fontSize: 12 }}/><Line type="monotone" dataKey="score" stroke="#8361cd" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}/>
  </ComposedChart></ResponsiveContainer></div>;
}
