import { winRates } from './balance.js';

const { rates, matrix } = winRates();
console.log('Overall win rate (hard AI vs hard AI, levels 1/50/100):');
for (const [id, rate] of Object.entries(rates)) console.log(`  ${id.padEnd(8)} ${(rate * 100).toFixed(0)}%`);
console.log('\nWins (row beat column):');
const ids = Object.keys(matrix);
console.log(`${''.padEnd(9)}${ids.map((i) => i.padEnd(9)).join('')}`);
for (const a of ids) console.log(`${a.padEnd(9)}${ids.map((b) => String(a === b ? '-' : matrix[a][b]).padEnd(9)).join('')}`);
