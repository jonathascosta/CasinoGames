import { isRed, rankLabel, type Card, type Suit } from '@casinogames/engine';
import { formatCount } from '../format/format.ts';
import { Container, Graphics, Text } from 'pixi.js';
import { readCssColor, shade } from '../dom/css.ts';
import { easeInOutCubic, easeOutCubic } from '../motion/motion.ts';
import { handStep, type CardView, type HandLayout, type ShoeDisplay } from '../cards/card-view.ts';
import { createPixiHost } from './host.ts';

interface Palette {
  readonly face: number;
  readonly edge: number;
  readonly red: number;
  readonly black: number;
  readonly back: number;
  readonly accent: number;
}

interface CardSprite {
  root: Container;
  /** Null while the face is unknown (dealt face down, not revealed yet). */
  front: Container | null;
  back: Container;
  card: Card | null;
  faceUp: boolean;
}

interface Pose {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scale: number;
}

/**
 * Cards dealt from a shoe, drawn with PixiJS: vector suit symbols, serif
 * indices, a lattice-pattern back, soft shadows. Cards slide from the shoe
 * with an ease-out (the hand re-centres as it grows) and flip by collapsing
 * horizontally while lifting.
 */
export async function createPixiCardView(
  container: HTMLElement,
  hands: readonly HandLayout[],
  scale = 1,
): Promise<CardView> {
  const host = await createPixiHost(container);
  const palette: Palette = {
    face: readCssColor(container, '--card-face', 0xfbf8f0),
    edge: readCssColor(container, '--card-edge', 0xd8cfbd),
    red: readCssColor(container, '--card-red', 0xbd2537),
    black: readCssColor(container, '--card-black', 0x16151a),
    back: readCssColor(container, '--card-back', 0x5a1422),
    accent: readCssColor(container, '--card-back-accent', 0xd9b56c),
  };
  const fontFamily =
    getComputedStyle(container).getPropertyValue('--font-display').trim() || 'Georgia, serif';

  const labelLayer = new Container();
  const shoeLayer = new Container();
  const tableLayer = new Container();
  host.app.stage.addChild(labelLayer, shoeLayer, tableLayer);
  const dealt = new Map<string, CardSprite[]>(hands.map((hand) => [hand.id, []]));
  let shoe: ShoeDisplay = { remaining: 0, size: 0, cutCardOut: false };

  const cardSize = () => {
    const height = Math.max(
      64,
      Math.min(
        150 * scale,
        host.height * 0.3 * scale,
        host.width * 0.28 * scale,
        host.height * 0.8,
      ),
    );
    return { w: height / 1.4, h: height };
  };
  const shoePoint = () => {
    const { w, h } = cardSize();
    return { x: host.width - w * 0.95, y: h * 0.62 };
  };
  const handOf = (id: string) => {
    const hand = hands.find((candidate) => candidate.id === id);
    const cards = dealt.get(id);
    if (hand === undefined || cards === undefined) throw new RangeError(`Unknown hand "${id}"`);
    return { hand, cards };
  };
  /** Cards overlap more as a hand grows, so it stays clear of the table's edge and the shoe. */
  const slot = (hand: HandLayout, index: number, count: number): Pose => {
    const { w } = cardSize();
    const centre = hand.x * host.width;
    return {
      x: centre + (index - (count - 1) / 2) * handStep(centre, host.width, w, count),
      y: hand.y * host.height,
      rotation: ((((index * 37) % 7) - 3) * Math.PI) / 360,
      scale: 1,
    };
  };

  function animate(duration: number, frame: (t: number) => void): Promise<void> {
    if (duration <= 0) {
      frame(1);
      host.render();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let elapsed = 0;
      host.animate((deltaMs) => {
        elapsed += deltaMs;
        const t = Math.min(1, elapsed / duration);
        frame(t);
        if (t < 1) return true;
        resolve();
        return false;
      });
    });
  }

  function build(card: Card | null, faceUp: boolean): CardSprite {
    const { w, h } = cardSize();
    const root = new Container();
    const shadow = new Graphics();
    for (const [grow, alpha] of [
      [4, 0.1],
      [2, 0.14],
      [0, 0.18],
    ] as const) {
      shadow
        .roundRect(-w / 2 - grow + 2, -h / 2 - grow + 5, w + grow * 2, h + grow * 2, w * 0.1 + grow)
        .fill({ color: 0x000000, alpha });
    }
    const back = drawBack(w, h, palette);
    back.visible = !faceUp;
    root.addChild(shadow, back);
    const sprite: CardSprite = { root, front: null, back, card: null, faceUp };
    if (card !== null) paintFace(sprite, card);
    return sprite;
  }

  function paintFace(sprite: CardSprite, card: Card): void {
    const { w, h } = cardSize();
    const front = drawFront(card, w, h, palette, fontFamily);
    front.visible = sprite.faceUp;
    sprite.root.addChild(front);
    sprite.front = front;
    sprite.card = card;
  }

  function place(sprite: CardSprite, pose: Pose): void {
    sprite.root.position.set(pose.x, pose.y);
    sprite.root.rotation = pose.rotation;
    sprite.root.scale.set(pose.scale);
  }

  function poseOf(sprite: CardSprite): Pose {
    const { root } = sprite;
    return { x: root.x, y: root.y, rotation: root.rotation, scale: root.scale.y };
  }

  function drawLabels(): void {
    labelLayer.removeChildren().forEach((child) => child.destroy());
    const { h } = cardSize();
    for (const hand of hands) {
      if (hand.label === undefined) continue;
      const label = new Text({
        text: hand.label.toUpperCase(),
        style: {
          fontFamily,
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 2.4,
          fill: palette.accent,
        },
      });
      label.alpha = 0.62;
      label.anchor.set(0.5, 0);
      label.position.set(hand.x * host.width, hand.y * host.height + h / 2 + 10);
      labelLayer.addChild(label);
    }
  }

  function drawShoe(): void {
    shoeLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    if (!Number.isFinite(shoe.size) || shoe.size === 0) return;
    const { w, h } = cardSize();
    const { x, y } = shoePoint();
    const bw = w * 0.95;
    const bh = h * 0.78;
    const left = x - bw * 0.35;
    // The next card emerges from the mouth on the left of the shoe.
    const peek = drawBack(w * 0.8, h * 0.8, palette);
    peek.position.set(left - w * 0.05, y + bh * 0.04);
    peek.rotation = -0.3;
    shoeLayer.addChild(peek);
    const box = new Graphics();
    if (shoe.cutCardOut) {
      box.roundRect(left + bw * 0.28, y - bh / 2 - h * 0.1, bw * 0.34, h * 0.24, 2).fill(0xc0392b);
    }
    box
      .roundRect(left, y - bh / 2, bw, bh, w * 0.1)
      .fill(0x120e0b)
      .stroke({ width: 1.5, color: palette.accent, alpha: 0.55 });
    box
      .roundRect(left + 5, y - bh / 2 + 5, bw - 10, bh - 10, w * 0.07)
      .stroke({ width: 1, color: palette.accent, alpha: 0.18 });
    shoeLayer.addChild(box);
    const counter = new Text({
      text: `${formatCount(shoe.remaining)} / ${formatCount(shoe.size)}`,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 11,
        fontWeight: '600',
        fill: 0xc8c0ad,
      },
    });
    counter.anchor.set(0.5, 0);
    counter.position.set(left + bw / 2, y + bh / 2 + 6);
    if (shoe.cutCardOut) counter.style.fill = 0xff8373;
    shoeLayer.addChild(counter);
  }

  async function flip(sprite: CardSprite, duration: number): Promise<void> {
    const base = poseOf(sprite);
    let swapped = false;
    await animate(duration, (t) => {
      const e = easeInOutCubic(t);
      if (!swapped && e >= 0.5) {
        swapped = true;
        sprite.back.visible = false;
        if (sprite.front !== null) sprite.front.visible = true;
        sprite.faceUp = true;
      }
      const lift = Math.sin(e * Math.PI) * 0.08;
      sprite.root.scale.set(
        Math.max(0.02, Math.abs(Math.cos(e * Math.PI))) * base.scale,
        base.scale + lift,
      );
      sprite.root.y = base.y - lift * 60;
    });
    sprite.root.scale.set(base.scale);
    sprite.root.y = base.y;
  }

  function relayout(): void {
    for (const [handId, cards] of dealt) {
      const { hand } = handOf(handId);
      cards.forEach((sprite, i) => {
        const rebuilt = build(sprite.card, sprite.faceUp);
        sprite.root.destroy({ children: true });
        sprite.root = rebuilt.root;
        sprite.front = rebuilt.front;
        sprite.back = rebuilt.back;
        tableLayer.addChild(sprite.root);
        place(sprite, slot(hand, i, cards.length));
      });
    }
    drawLabels();
    drawShoe();
  }

  host.onResize(relayout);
  drawLabels();
  drawShoe();
  host.render();

  return {
    async deal(card, handId, duration) {
      const { hand, cards } = handOf(handId);
      const sprite = build(card, false);
      const { w } = cardSize();
      const start = shoePoint();
      place(sprite, { x: start.x - w * 0.25, y: start.y + 6, rotation: -0.32, scale: 0.86 });
      tableLayer.addChild(sprite.root);
      cards.push(sprite);
      const from = cards.map(poseOf);
      const to = cards.map((_, i) => slot(hand, i, cards.length));
      await animate(duration, (t) => {
        const e = easeOutCubic(t);
        cards.forEach((each, i) => {
          const a = from[i]!;
          const b = to[i]!;
          place(each, {
            x: a.x + (b.x - a.x) * e,
            y: a.y + (b.y - a.y) * e,
            rotation: a.rotation + (b.rotation - a.rotation) * e,
            scale: a.scale + (b.scale - a.scale) * e,
          });
        });
      });
    },
    async reveal(handId, index, card, duration) {
      const sprite = handOf(handId).cards[index];
      if (sprite === undefined) throw new RangeError(`No card ${index} in "${handId}"`);
      if (sprite.card === null) {
        paintFace(sprite, card);
      } else if (sprite.card.rank !== card.rank || sprite.card.suit !== card.suit) {
        throw new Error(`Card ${index} in "${handId}" is not the revealed card`);
      }
      if (!sprite.faceUp) await flip(sprite, duration);
    },
    async clear(duration) {
      const all = [...dealt.values()].flat();
      const from = all.map(poseOf);
      const { w, h } = cardSize();
      await animate(duration, (t) => {
        const e = easeInOutCubic(t);
        all.forEach((sprite, i) => {
          const a = from[i]!;
          place(sprite, {
            x: a.x + (-w - a.x) * e,
            y: a.y + (-h * 0.5 - a.y) * e,
            rotation: a.rotation - e * 0.5,
            scale: a.scale,
          });
          sprite.root.alpha = 1 - e;
        });
      });
      for (const cards of dealt.values()) {
        for (const sprite of cards.splice(0)) sprite.root.destroy({ children: true });
      }
      host.render();
    },
    async shuffle(duration) {
      const { x, y } = shoePoint();
      shoeLayer.pivot.set(x, y);
      shoeLayer.position.set(x, y);
      await animate(duration, (t) => {
        const wobble = Math.sin(t * Math.PI * 7) * (1 - t);
        shoeLayer.rotation = wobble * 0.05;
        shoeLayer.scale.set(1 + Math.sin(t * Math.PI) * 0.06);
      });
      shoeLayer.rotation = 0;
      shoeLayer.scale.set(1);
      shoeLayer.pivot.set(0, 0);
      shoeLayer.position.set(0, 0);
      host.render();
    },
    setShoe(next) {
      shoe = next;
      drawShoe();
      host.render();
    },
    destroy() {
      host.destroy();
    },
  };
}

function drawFront(
  card: Card,
  w: number,
  h: number,
  palette: Palette,
  fontFamily: string,
): Container {
  const front = new Container();
  const color = isRed(card.suit) ? palette.red : palette.black;
  front.addChild(
    new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, w * 0.085)
      .fill(palette.face)
      .stroke({ width: 1, color: palette.edge }),
  );

  // Indices in two opposite corners.
  for (const turned of [false, true]) {
    const corner = new Container();
    const rank = new Text({
      text: rankLabel(card.rank),
      style: { fontFamily, fontSize: w * 0.24, fontWeight: '700', fill: color },
    });
    rank.anchor.set(0.5, 0);
    const pip = new Graphics();
    drawSuit(pip, card.suit, 0, w * 0.34, w * 0.075, color);
    corner.addChild(rank, pip);
    corner.position.set(-w / 2 + w * 0.15, -h / 2 + h * 0.045);
    if (turned) {
      corner.rotation = Math.PI;
      corner.position.set(w / 2 - w * 0.15, h / 2 - h * 0.045);
    }
    front.addChild(corner);
  }

  const centre = new Graphics();
  if (card.rank >= 11) {
    // Court cards: a framed serif letter over a small suit.
    centre
      .roundRect(-w * 0.27, -h * 0.29, w * 0.54, h * 0.58, w * 0.05)
      .fill({ color, alpha: 0.05 })
      .stroke({ width: 1.2, color: shade(palette.accent, 0.8), alpha: 0.9 });
    drawSuit(centre, card.suit, 0, h * 0.17, w * 0.08, color);
    const letter = new Text({
      text: rankLabel(card.rank),
      style: { fontFamily, fontSize: w * 0.44, fontWeight: '600', fill: color },
    });
    letter.anchor.set(0.5);
    letter.position.set(0, -h * 0.05);
    front.addChild(centre, letter);
  } else {
    drawSuit(centre, card.suit, 0, 0, w * (card.rank === 1 ? 0.25 : 0.19), color);
    front.addChild(centre);
  }
  return front;
}

function drawBack(w: number, h: number, palette: Palette): Container {
  const back = new Container();
  const g = new Graphics();
  const radius = w * 0.085;
  g.roundRect(-w / 2, -h / 2, w, h, radius)
    .fill(palette.back)
    .stroke({ width: 1, color: shade(palette.back, 0.55) });
  const inset = w * 0.075;
  const step = w * 0.13;
  const half = step * 0.3;
  let row = 0;
  for (let y = -h / 2 + inset * 1.9; y <= h / 2 - inset * 1.9; y += step * 0.5, row++) {
    const shift = row % 2 === 0 ? 0 : step / 2;
    for (let x = -w / 2 + inset * 1.9 + shift; x <= w / 2 - inset * 1.9; x += step) {
      g.poly([x, y - half, x + half, y, x, y + half, x - half, y]).fill({
        color: palette.accent,
        alpha: 0.16,
      });
    }
  }
  g.roundRect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, radius * 0.6).stroke({
    width: 1.2,
    color: palette.accent,
    alpha: 0.85,
  });
  g.circle(0, 0, w * 0.19)
    .fill(palette.back)
    .stroke({ width: 1.4, color: palette.accent });
  g.poly([0, -w * 0.1, w * 0.07, 0, 0, w * 0.1, -w * 0.07, 0]).fill(palette.accent);
  back.addChild(g);
  return back;
}

/** Vector suit symbols centred on (cx, cy) with half-extent s. */
function drawSuit(g: Graphics, suit: Suit, cx: number, cy: number, s: number, color: number): void {
  const X = (x: number) => cx + x * s;
  const Y = (y: number) => cy + y * s;
  switch (suit) {
    case 'hearts':
      g.moveTo(X(0), Y(0.95))
        .bezierCurveTo(X(-0.2), Y(0.72), X(-1), Y(0.25), X(-1), Y(-0.3))
        .bezierCurveTo(X(-1), Y(-0.85), X(-0.35), Y(-1.05), X(0), Y(-0.55))
        .bezierCurveTo(X(0.35), Y(-1.05), X(1), Y(-0.85), X(1), Y(-0.3))
        .bezierCurveTo(X(1), Y(0.25), X(0.2), Y(0.72), X(0), Y(0.95))
        .fill(color);
      break;
    case 'diamonds':
      g.moveTo(X(0), Y(-1))
        .quadraticCurveTo(X(0.35), Y(-0.35), X(0.78), Y(0))
        .quadraticCurveTo(X(0.35), Y(0.35), X(0), Y(1))
        .quadraticCurveTo(X(-0.35), Y(0.35), X(-0.78), Y(0))
        .quadraticCurveTo(X(-0.35), Y(-0.35), X(0), Y(-1))
        .fill(color);
      break;
    case 'spades':
      g.moveTo(X(0), Y(-1))
        .bezierCurveTo(X(0.25), Y(-0.7), X(1), Y(-0.3), X(1), Y(0.2))
        .bezierCurveTo(X(1), Y(0.62), X(0.5), Y(0.82), X(0.12), Y(0.5))
        .quadraticCurveTo(X(0.18), Y(0.85), X(0.38), Y(1))
        .lineTo(X(-0.38), Y(1))
        .quadraticCurveTo(X(-0.18), Y(0.85), X(-0.12), Y(0.5))
        .bezierCurveTo(X(-0.5), Y(0.82), X(-1), Y(0.62), X(-1), Y(0.2))
        .bezierCurveTo(X(-1), Y(-0.3), X(-0.25), Y(-0.7), X(0), Y(-1))
        .fill(color);
      break;
    case 'clubs':
      g.circle(X(0), Y(-0.46), 0.4 * s).fill(color);
      g.circle(X(-0.47), Y(0.12), 0.4 * s).fill(color);
      g.circle(X(0.47), Y(0.12), 0.4 * s).fill(color);
      g.circle(X(0), Y(0.02), 0.24 * s).fill(color);
      g.moveTo(X(-0.1), Y(0.3))
        .quadraticCurveTo(X(-0.12), Y(0.85), X(-0.36), Y(1))
        .lineTo(X(0.36), Y(1))
        .quadraticCurveTo(X(0.12), Y(0.85), X(0.1), Y(0.3))
        .closePath()
        .fill(color);
      break;
  }
}
