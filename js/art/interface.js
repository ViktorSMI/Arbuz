import { landStyle } from './palette.js';
import { getSetting, setSetting } from '../settings.js';
import { LORE_ENTRIES } from '../lore.js';
import { ENEMY_COUNT } from '../constants.js';

export const interfaceState={journalOpen:false};
const paths=[
  '<path d="M4 17 13 7l-1 6h8L9 23l2-6z"/>',
  '<path d="m6 5 6 10 6-10M5 18l-3 5h20l-3-5M12 15v7"/>',
  '<path d="M20 4C4 3 1 17 7 21s14-4 13-17Z"/><path d="m7 20 9-12"/>',
  '<path d="M6 24C21 19 5 10 19 3M10 14C3 14 3 6 3 6s9 0 7 8ZM13 19c7 1 9-6 9-6s-9-2-9 6Z"/>',
  '<path d="m12 2 9 4v8c-1 5-9 10-9 10S4 20 3 14V6z"/><path d="M12 6v13M7 11l5 5 5-5"/>',
  '<path d="m6 2-2 6m10-6-2 6m10-6-2 6M8 12l-3 7m11-7-3 7m10-7-3 7M2 23h20"/>',
  '<path d="m12 2 8 5 2 9-10 8L2 16l2-9z"/><path d="m4 7 8 6 8-6m-8 6v11M2 16l10-3 10 3"/>',
];
export function skillIcon(index,unlocked) {
  return `<svg viewBox="0 0 26 26" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${unlocked?paths[index]:'<rect x="6" y="11" width="14" height="12" rx="2"/><path d="M9 11V7a4 4 0 0 1 8 0v4M13 16v3"/>'}</svg>`;
}
export function showJournal(player,location,bossState) {
  interfaceState.journalOpen=true;
  document.getElementById('quest-panel').style.display='flex';
  const content=document.getElementById('quest-list'); content.replaceChildren();
  const intro=document.createElement('div'); intro.className='quest-card';
  const title=document.createElement('h3'); title.textContent=landStyle(location-1).name; intro.append(title);
  const p=document.createElement('p'); p.textContent=bossState.bossDefeated?'Страж повержен. Найдите проход в следующую землю.':'Найдите логово стража.'; intro.append(p); content.append(intro);
  for(const entry of LORE_ENTRIES.filter(e=>(player.foundLore||[]).includes(e.id))) {
    const card=document.createElement('article');card.className='quest-card';
    const h=document.createElement('h3');h.textContent=entry.title;
    const text=document.createElement('p');text.textContent=entry.text;
    card.append(h,text);content.append(card);
  }
  if(!(player.foundLore||[]).length) { const empty=document.createElement('p');empty.textContent='Камни памяти ещё не найдены.';content.append(empty); }
  const stats=document.getElementById('campaign-stats'); stats.textContent=`Уровень ${player.level} · Камни памяти: ${(player.foundLore||[]).length} / 18 · Семечки: ${player.seeds}`;
  document.exitPointerLock();
}
export function closeJournal(){interfaceState.journalOpen=false;document.getElementById('quest-panel').style.display='none';}
export function setupInterface({player,location,bossState,save,onMenu,onQuality}) {
  document.querySelectorAll('[data-close-journal],#btn-quest-close').forEach(el=>el.addEventListener('click',closeJournal));
  document.getElementById('btn-open-journal')?.addEventListener('click',()=>showJournal(player,location(),bossState));
  document.getElementById('btn-save-now')?.addEventListener('click',()=>{const saved=save();document.getElementById('save-status').textContent=saved?'Сохранено в этом браузере':'Браузер не разрешил сохранение';});
  document.getElementById('btn-return-menu')?.addEventListener('click',onMenu);
  document.querySelectorAll('[data-close-inventory]').forEach(el=>el.addEventListener('click',()=>document.getElementById('btn-inv-close').click()));
  const quality=document.getElementById('set-quality');
  quality.value=getSetting('quality')||'medium';
  quality.addEventListener('change',()=>{setSetting('quality',quality.value);onQuality();});
  onQuality();
}
export function updateMission(player,location,bossState){
  document.getElementById('mission-act').textContent=landStyle(location-1).name;
  document.getElementById('mission-objective').textContent=bossState.bossDefeated?'Найдите проход в следующую землю.':bossState.bossActive?'Победите стража.':'Найдите логово стража.';
  document.getElementById('mission-progress-fill').style.width=bossState.bossDefeated?'100%':`${Math.min(100,player.kills/ENEMY_COUNT*100)}%`;
  document.getElementById('mission-secondary').textContent=`Камни памяти: ${(player.foundLore||[]).length} / 18 · J — журнал`;
}
