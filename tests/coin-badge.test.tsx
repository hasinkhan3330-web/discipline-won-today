import { expect, test, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
// CSS modules are not evaluated by the server renderer; render actual React component.
mock.module('../src/components/coin-badge.module.css',()=>({default:{badge:'badge',icon:'icon',check:'check',burst:'burst'}}));
const { CoinBadge }=await import('../src/components/CoinBadge');
for(const [state,label] of [['available','Reward: 10 coins'],['earned','Earned: 10 coins'],['disabled','Reward: 10 coins']] as const) test(`CoinBadge ${state} exposes actual 10 coin reward`,()=>{const html=renderToStaticMarkup(<CoinBadge amount={10} state={state}/>);expect(html).toContain(`aria-label="${label}"`);expect(html).toContain('+10');});
test('CoinBadge balance exposes real 39 coins',()=>{const html=renderToStaticMarkup(<CoinBadge amount={39} variant="balance"/>);expect(html).toContain('Balance: 39 coins');expect(html).toContain('39 coins');expect(html).not.toContain('+39');});
