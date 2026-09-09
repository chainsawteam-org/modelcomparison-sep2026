/**
 * Headless balance harness. Runs the pure game model against scripted players
 * of different skill levels so difficulty can be checked without playing.
 *
 *   npm run sim
 */
import { GameModel } from '../src/game/model';
import type { Orb } from '../src/game/types';

interface Profile {
  name: string;
  /** Seconds between the player's actions. */
  react: number;
  /** Probability the player picks the right orb rather than the front one. */
  smart: number;
}

function playOne(profile: Profile, seed: number) {
  const m = new GameModel(seed);
  const dt = 1 / 60;
  let cooldown = profile.react;
  let steps = 0;
  while (!m.over && steps < 60 * 60 * 20) {
    steps++;
    m.update(dt);
    cooldown -= dt;
    if (cooldown > 0) continue;
    cooldown = profile.react;

    // Slag hogs a slot and nothing accepts it: burn it as soon as the vent is up.
    const slag = m.queue.find((o) => o.kind === 'slag');
    if (slag && m.incinerator <= 0) { m.ventOrb(slag.id); continue; }

    const candidates: { orb: Orb; bay: number; score: number }[] = [];
    for (const orb of m.queue) {
      const bay = m.suggestBay(orb);
      if (bay < 0) continue;
      const b = m.bays[bay];
      let s = 10 - (b.required - b.filled);
      if (b.priority) s += 5;
      candidates.push({ orb, bay, score: s });
    }
    if (!candidates.length) {
      // Fully stuck: dump the front orb if the vent allows it.
      if (m.queue.length > 6 && m.incinerator <= 0) m.ventOrb(m.queue[0].id);
      continue;
    }
    candidates.sort((a, b) => b.score - a.score);
    const pick = Math.random() < profile.smart ? candidates[0] : candidates[candidates.length - 1];
    m.deploy(pick.orb.id, pick.bay);
  }
  return m.stats;
}

const profiles: Profile[] = [
  { name: 'sloppy ', react: 1.5, smart: 0.15 },
  { name: 'novice ', react: 0.85, smart: 0.35 },
  { name: 'average', react: 0.5, smart: 0.7 },
  { name: 'expert ', react: 0.28, smart: 1.0 },
];

const runs = 40;
console.log('profile   |  time (s)          |  wave      |  score                   |  peak');
console.log('----------+--------------------+------------+------------------');
for (const p of profiles) {
  const times: number[] = [], waves: number[] = [], scores: number[] = [], mults: number[] = [], chains: number[] = [];
  for (let i = 0; i < runs; i++) {
    const s = playOne(p, 1000 + i);
    times.push(s.time); waves.push(s.wave); scores.push(s.score); mults.push(s.bestMultiplier); chains.push(s.bestChain);
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const min = (a: number[]) => Math.min(...a);
  const max = (a: number[]) => Math.max(...a);
  console.log(
    `${p.name}   |  ${avg(times).toFixed(0).padStart(4)} (${min(times).toFixed(0)}-${max(times).toFixed(0)})`.padEnd(46) +
    `|  ${avg(waves).toFixed(1)} (max ${max(waves)})`.padEnd(13) +
    `|  ${Math.round(avg(scores))} (max ${Math.round(max(scores))})`.padEnd(26) +
    `|  x${avg(mults).toFixed(1)}  chain ${avg(chains).toFixed(1)}`,
  );
}
