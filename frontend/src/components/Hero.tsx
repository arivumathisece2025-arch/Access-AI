import { motion } from 'framer-motion';
import { Eye, Hand, Volume2, WifiOff, Zap } from 'lucide-react';
import { useState } from 'react';

const STATS = [
  { icon: Zap, value: '1.48s', label: 'per image query' },
  { icon: WifiOff, value: '100% offline', label: 'no cloud, no quotas' },
  { icon: Hand, value: '12 ISL phrases', label: 'real human signers' },
];

export default function Hero() {
  const [imageAvailable, setImageAvailable] = useState(true);

  return (
    <motion.section className="hero" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <div className="hero-copy">
        <h2 className="hero-title">One assistant for <span className="grad-text">every sense</span>.</h2>
        <p className="hero-sub">Access AI sees for the blind, speaks for the text-bound, and signs for the Deaf - on-device, in 1.5 seconds, forever free.</p>
        <div className="hero-stats">
          {STATS.map((stat, index) => {
            const Icon = stat.icon;
            return <motion.div key={stat.value} className="stat-chip" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + index * 0.12 }}><Icon size={18} className="stat-icon" aria-hidden="true" /><div><strong>{stat.value}</strong><span>{stat.label}</span></div></motion.div>;
          })}
        </div>
      </div>
      <motion.div className="hero-art" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }}>
        {imageAvailable ? <img src="/hero.jpg" onError={() => setImageAvailable(false)} alt="Warm illustration: a phone describing a scene with sound waves, hands signing, and a person walking with a white cane along a path of light" /> : <div className="hero-fallback" aria-label="Access AI sees, speaks, and signs"><Eye size={40} aria-hidden="true" /><Volume2 size={40} aria-hidden="true" /><Hand size={40} aria-hidden="true" /></div>}
        <motion.div className="hero-float hero-float-1" animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}><Eye size={16} aria-hidden="true" /> sees</motion.div>
        <motion.div className="hero-float hero-float-2" animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}><Volume2 size={16} aria-hidden="true" /> speaks</motion.div>
        <motion.div className="hero-float hero-float-3" animate={{ y: [0, -8, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}><Hand size={16} aria-hidden="true" /> signs</motion.div>
      </motion.div>
    </motion.section>
  );
}
