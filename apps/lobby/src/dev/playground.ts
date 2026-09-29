/**
 * Component playground: every UI kit component, live, on one page. It is a
 * development and review aid, deliberately free of Storybook.
 */
import {
  createCryptoRng,
  createSeededRng,
  diceTotal,
  odds,
  rollDice,
  Shoe,
  type Card,
  oddsLabel,
  settleLoss,
  settleWin,
  type Odds,
} from '@casinogames/engine';
import {
  Bankroll,
  BankrollDisplay,
  BetSpot,
  CardDealer,
  ChipRail,
  DiceRoller,
  SoundEngine,
  applySettings,
  createMemoryBackend,
  createSafeStorage,
  createSettingsStore,
  createSoundToggle,
  createTurboToggle,
  formatCents,
  h,
  motion,
  type Child,
  type SoundName,
} from '@casinogames/ui';
import '@casinogames/ui/theme.css';
import './playground.css';

const storage = createSafeStorage('playground', createMemoryBackend());
const bankroll = new Bankroll({ storage, initial: 250_00 });
const cosmeticRng = createSeededRng('playground');
const settings = createSettingsStore(storage);
const sound = new SoundEngine();
sound.unlockOnFirstGesture();
applySettings(settings, { motion, sound });

function button(label: string, onClick: () => void, variant = ''): HTMLButtonElement {
  const element = h('button', { type: 'button', class: `cg-btn ${variant}`.trim() }, label);
  element.addEventListener('click', onClick);
  return element;
}

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

function bankrollSection(): HTMLElement {
  const display = new BankrollDisplay({ bankroll, topUpBelow: 50 });
  return section(
    'bankroll',
    'BankrollDisplay',
    'Counts to each new balance with a floating delta. Below the table minimum it offers a ' +
      'top-up to the starting balance. Persisted in localStorage in the real lobby.',
    display.element,
    h(
      'div',
      { class: 'pg-row' },
      button('Win 25.00', () => {
        bankroll.credit(25_00);
        sound.play('win');
      }),
      button('Lose 5.00', () => {
        bankroll.debit(Math.min(5_00, bankroll.balance));
      }),
      button('Drain', () => {
        bankroll.debit(bankroll.balance);
      }),
    ),
  );
}

function settingsSection(): HTMLElement {
  const sounds: SoundName[] = [
    'chip',
    'chip-stack',
    'dice-shake',
    'dice-bounce',
    'card-slide',
    'card-flip',
    'shuffle',
    'win',
    'big-win',
    'lose',
    'click',
  ];
  return section(
    'settings',
    'Turbo mode, sound toggle and synthesiser',
    'Turbo zeroes every animation duration; sound is synthesised with Web Audio (no audio ' +
      'files). Tap a pad to audition each effect.',
    h(
      'div',
      { class: 'pg-row' },
      createTurboToggle(settings, { showLabel: true }).element,
      createSoundToggle(settings, { showLabel: true }).element,
    ),
    h(
      'div',
      { class: 'pg-row' },
      ...sounds.map((name) =>
        button(
          name,
          () => {
            sound.play(name, { intensity: 0.8 });
          },
          'cg-btn--ghost',
        ),
      ),
    ),
  );
}

function diceSection(): HTMLElement {
  const stage = h('div', { class: 'pg-stage' });
  const result = h('strong', { class: 'cg-num' }, '—');
  const rollButton = h('button', { type: 'button', class: 'cg-btn cg-btn--primary' }, 'Roll');
  const rng = createCryptoRng();
  let roller: DiceRoller | undefined;

  const onThrow = async (power: number) => {
    rollButton.disabled = true;
    const dice = rollDice(rng); // the engine decides; the roller only animates
    await roller?.roll(dice, { power });
    result.textContent = `${dice[0]} + ${dice[1]} = ${diceTotal(dice)}`;
    roller?.arm();
    rollButton.disabled = false;
  };
  void DiceRoller.create({
    host: stage,
    sound,
    onThrow: (power) => void onThrow(power),
  }).then((created) => {
    roller = created;
    roller.arm();
  });
  rollButton.addEventListener('click', () => roller?.requestThrow());

  return section(
    'dice',
    'DiceRoller',
    'Tap the felt to throw, or hold to shake and release: the longer the hold, the harder the ' +
      'throw. 3D dice in PixiJS (lit, bevelled, perspective), landing exactly on the values the ' +
      'engine rolled with the crypto RNG.',
    stage,
    h('div', { class: 'pg-row' }, rollButton, h('p', { class: 'pg-note' }, 'Last roll ', result)),
  );
}

function cardsSection(): HTMLElement {
  const stage = h('div', { class: 'pg-stage pg-stage--tall' });
  const shoe = new Shoe({ decks: 6 });
  const rng = createCryptoRng();
  let dealer: CardDealer | undefined;
  let hole: Card | undefined;
  const dealButton = h('button', { type: 'button', class: 'cg-btn cg-btn--primary' }, 'Deal');
  const revealButton = h('button', { type: 'button', class: 'cg-btn', disabled: true }, 'Reveal');

  const draw = (): Card => {
    const card = shoe.draw(rng);
    dealer?.setShoe(shoe.remaining(), shoe.size(), shoe.isCutCardOut());
    return card;
  };
  const deal = async () => {
    if (dealer === undefined) return;
    dealButton.disabled = true;
    revealButton.disabled = true;
    await dealer.clear();
    if (shoe.beginRound(rng)) {
      dealer.setShoe(shoe.remaining(), shoe.size());
      await dealer.shuffle();
    }
    await dealer.deal(draw(), 'player');
    await dealer.deal(draw(), 'dealer');
    await dealer.deal(draw(), 'player');
    hole = draw();
    await dealer.deal(hole, 'dealer', { faceUp: false });
    dealButton.disabled = false;
    revealButton.disabled = false;
  };
  dealButton.addEventListener('click', () => void deal());
  revealButton.addEventListener('click', () => {
    revealButton.disabled = true;
    if (hole !== undefined) void dealer?.reveal('dealer', 1, hole);
  });
  void CardDealer.create({
    host: stage,
    sound,
    hands: [
      { id: 'dealer', label: 'Dealer', x: 0.4, y: 0.24 },
      { id: 'player', label: 'Player', x: 0.5, y: 0.66 },
    ],
  }).then((created) => {
    dealer = created;
    dealer.setShoe(shoe.size(), shoe.size());
  });

  return section(
    'cards',
    'CardDealer',
    'Cards slide from a six-deck engine Shoe (cut card at 75% penetration) and flip; the hole ' +
      'card is dealt face down until revealed. Vector suits and a lattice back, drawn in PixiJS.',
    stage,
    h('div', { class: 'pg-row' }, dealButton, revealButton),
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
  h(
    'div',
    { class: 'pg-grid' },
    diceSection(),
    cardsSection(),
    bettingSection(),
    bankrollSection(),
    settingsSection(),
  ),
);
