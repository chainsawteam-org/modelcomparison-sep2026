import './style.css';
import { Game } from './game';

const host=document.querySelector<HTMLElement>('#app')!;
try {
  const game=new Game(host);
  // Development-only inspection supports deterministic integration playtests.
  // Vite removes this branch from the production bundle.
  if(import.meta.env.DEV)(window as unknown as {__LAST_SIGNAL__:Game}).__LAST_SIGNAL__=game;
}catch(error){
  console.error(error);
  host.innerHTML='<div class="loading-error"><h1>Connection interrupted.</h1><p>Last Signal needs a browser with WebGL 2 and hardware acceleration. Enable hardware acceleration in your browser settings, then reload to reconnect.</p><button class="primary" onclick="location.reload()">RECONNECT ↗</button></div>';
}
