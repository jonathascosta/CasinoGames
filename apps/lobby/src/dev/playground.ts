/**
 * Component playground: every UI kit component, live, on one page. It is a
 * development and review aid, deliberately free of Storybook.
 */
import {
  createSeededRng,
  odds,
  oddsLabel,
  settleLoss,
  settleWin,
  type Odds,
} from '@casinogames/engine';
import {
  Bankroll,
  BetSpot,
  ChipRail,
  createMemoryBackend,
  createSafeStorage,
  formatCents,
  h,
  type Child,
} from '@casinogames/ui';
import '@casinogames/ui/theme.css';
import './playground.css';

const storage = createSafeStorage('playground', createMemoryBackend());
const bankroll = new Bankroll({ storage, initial: 250_00 });
const cosmeticRng = createSeededRng('playground');

function section(id: string, title: string, description: string, ...demo: Child[]): HTMLElement {
  return h(
    'section',
    { class: 'pg-section cg-panel', id },
    h('header', null, h('h2', null, title), h('p', null, description)),
    h('div', { class: 'pg-demo' }, ...demo),
  );
}

function bettingSection(): HTMLElement {
  const pending = h('strong', { class: 'cg-num' }, '0.00');
  const note = h(
    'p',
    { class: 'pg-note' },
    'Pending stake ',
    pending,
    ' · balance ',
    h('strong', { class: 'cg-num' }, formatCents(bankroll.balance)),
  );
  const rail = new ChipRail({ value: 500 });
  rail.setBalance(bankroll.balance);

  const spots: BetSpot[] = [];
  const total = () => spots.reduce((sum, spot) => sum + spot.amount, 0);
  const update = () => {
    pending.textContent = formatCents(total());
  };
  const payouts = new Map<BetSpot, Odds>();
  const spot = (id: string, label: string, pays: Odds, variant: 'main' | 'side', max: number) => {
    const created = new BetSpot({
      id,
      label,
      caption: `pays ${oddsLabel(pays)}`,
      variant,
      max,
      chipValue: () => rail.value,
      canAdd: (amount) => bankroll.canAfford(total() + amount),
      onChange: update,
    });
    payouts.set(created, pays);
    return created;
  };
  spots.push(
    spot('main', 'Main', odds(1), 'main', 100_00),
    spot('pair', 'Pair', odds(11), 'side', 25_00),
  );
  spots[0]!.setAmount(1_500);
  update();

  let settled = false;
  const settle = h('button', { type: 'button', class: 'cg-btn' }, 'Preview result');
  settle.addEventListener('click', () => {
    settled = !settled;
    for (const s of spots) {
      s.setLocked(settled);
      if (!settled || s.amount === 0) {
        s.setResult(null);
      } else {
        const won = cosmeticRng.next() < 0.5;
        s.setResult(won ? settleWin(s.amount, payouts.get(s)!) : settleLoss(s.amount));
      }
    }
    settle.textContent = settled ? 'Clear result' : 'Preview result';
  });

  return section(
    'betting',
    'ChipRail + BetSpot',
    'Pick a chip, tap a spot to add it, long-press (or right-click / Delete) to clear. ' +
      'Chips above the balance are disabled; spots refuse stakes over their maximum or the bankroll.',
    h('div', { class: 'pg-row' }, ...spots.map((s) => s.element)),
    rail.element,
    note,
    settle,
  );
}

const app = document.getElementById('app')!;
app.className = 'pg';
app.append(
  h(
    'header',
    { class: 'pg-header' },
    h('span', { class: 'cg-eyebrow' }, 'UI kit'),
    h('h1', null, 'Component playground'),
    h(
      'p',
      null,
      'Every shared component of the table kit, live. The engine drives the outcomes; ' +
        'this page only wires them to the controls.',
    ),
  ),
  h('div', { class: 'pg-grid' }, bettingSection()),
);
