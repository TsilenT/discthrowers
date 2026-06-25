/**
 * Disc-golf reskin of Flapjacks & Sasquatches.
 *
 * Flavour mapping:
 *   axes      → drivers (disc-golf discs)
 *   trees     → baskets / holes
 *   chops     → throws
 *   Sasquatch → Hooligans (rowdy course creatures)
 *   felling a tree → sinking a basket / completing a hole
 *   players → disc golfers
 *
 * Only names and rules text change.  Categories, tree stats, and
 * all engine mechanics are IDENTICAL to the base game.
 * This theme is self-contained — it does not import any other theme.
 */

import type { ThemeContent, CardDisplay, TreeDisplay } from "./types";
import { treeStats } from "../engine/cards/catalog";

// ---------------------------------------------------------------------------
// Card overrides — disc-golf flavoured names and rules text
// ---------------------------------------------------------------------------
const DG_CARDS: Record<string, CardDisplay> = {
  // ---- Equipment (axes → drivers) ----------------------------------------
  "carpenters-axe": {
    name: "Standard Driver",
    rulesText: "A reliable disc driver. Lets you attempt a throw (base 3 dice).",
    category: "equipment",
  },
  "chopping-axe": {
    name: "Distance Driver",
    rulesText: "A purpose-built distance disc. Lets you attempt a throw (base 3 dice).",
    category: "equipment",
  },
  "swedish-broad-axe": {
    name: "Fairway Driver",
    rulesText: "A versatile fairway disc. Lets you attempt a throw (base 3 dice).",
    category: "equipment",
  },
  "double-bladed-axe": {
    name: "Overstable Driver",
    rulesText: "A high-performance disc with exceptional stability. Throws with one extra die (base 4).",
    category: "equipment",
  },
  "titanium-axe": {
    name: "Pro-Stamped Driver",
    rulesText:
      "A tournament-grade disc that never warps. Throws with one extra die (base 4). Disc Swap and disc-destroying cards cannot affect it.",
    category: "equipment",
  },
  "dull-axe": {
    name: "Warped Disc",
    rulesText:
      "A beat-up, flight-impaired disc. Throws with one fewer die (base 2). Usually tossed into an opponent's bag to slow them down.",
    category: "equipment",
  },
  "boots": {
    name: "Cleats",
    rulesText: "Proper disc-golf footwear. No one can play Muddy Lie on you.",
    category: "equipment",
  },
  "gloves": {
    name: "Grip Gloves",
    rulesText:
      "Textured throwing gloves. No one can play Sore Fingers or Disc Slip on you. Removes Sore Fingers if you already had it.",
    category: "equipment",
  },

  // ---- Plus/Minus ---------------------------------------------------------
  "flapjacks": {
    name: "Tailwind",
    rulesText:
      "A perfect tailwind behind your throw. Add two dice to your throw this turn. If you don't throw, it's discarded with no effect.",
    category: "plus-minus",
  },
  "short-stack": {
    name: "Slight Tailwind",
    rulesText:
      "A gentle tailwind. Add one die to your throw this turn. If you don't throw, it's discarded with no effect.",
    category: "plus-minus",
  },
  "side-of-bacon": {
    name: "Downhill Lie",
    rulesText:
      "A favourable lie on a slope. Add one die to your next throw. Can be combined with Tailwind or Slight Tailwind as a single play; if so, draw a card immediately.",
    category: "plus-minus",
  },
  "axe-slip": {
    name: "Disc Slip",
    rulesText: "Opponent's disc slips from their grip. Subtract one die from their next throw.",
    category: "plus-minus",
  },
  "foot-slip": {
    name: "Muddy Lie",
    rulesText:
      "Opponent is stuck in the mud. Subtract two dice from their next throw. Blocked by Cleats.",
    category: "plus-minus",
  },
  "winded": {
    name: "Headwind",
    rulesText: "A stiff headwind into the target's face. Subtract two dice from their next throw.",
    category: "plus-minus",
  },
  "blisters": {
    name: "Sore Fingers",
    rulesText:
      "Tender throwing fingers from too many rounds. Subtract one die from all of the target's throws until they get Grip Gloves.",
    category: "plus-minus",
  },

  // ---- Help ---------------------------------------------------------------
  "apprentice": {
    name: "Caddy",
    rulesText:
      "A junior course helper. When you manage the help, roll one die; on 4/5/6 add a throw to your basket. Otherwise nothing — a Caddy can't overshoot.",
    category: "help",
  },
  "babe": {
    name: "Blue Ox",
    rulesText:
      "A legendary power caddy. When you manage the help, roll two dice; each 4/5/6 adds a throw to your basket. Cannot be poached with Bag Snatch (only Blue Ox Biscuit moves it).",
    category: "help",
  },
  "long-saw-and-partner": {
    name: "Tandem Throwers",
    rulesText:
      "Two disc golfers attacking the basket together. While in play, your own driver is sidelined (you can't throw solo). When you manage the help, roll five dice; each 4/5/6 is a throw. If 4+ dice are flubs/misses, pass Tandem Throwers to the player on your right.",
    category: "help",
  },

  // ---- Sasquatch → Hooligans ---------------------------------------------
  "sasquatch-rampage": {
    name: "Hooligan Rampage",
    rulesText:
      "A rowdy gang of hooligans overruns the course! Everyone discards their whole hand immediately. At the start of each player's next turn they draw up to four cards instead of one.",
    category: "sasquatch",
  },
  "sasquatch-sighting": {
    name: "Hooligan Sighting",
    rulesText:
      "Hooligans spotted on the fairway! Every player except the one who played this card rolls a die; on 1/2/3 they lose their next turn.",
    category: "sasquatch",
  },
  "that-darn-sasquatch": {
    name: "Those Darn Hooligans",
    rulesText:
      "Hooligans trash everyone's gear! Discard all Equipment cards in play, including your own.",
    category: "sasquatch",
  },
  "sasquatch-mating-season": {
    name: "Hooligan Standoff",
    rulesText:
      "A hooligan confrontation halts a player's round. Target loses their next turn. Optionally claim their current basket (throws included); if you do and already had one, your old basket is abandoned.",
    category: "sasquatch",
  },
  "paul-bunyan": {
    name: "Course Sweep",
    rulesText:
      "An official course sweep completes every basket at once! Every player's standing basket is scored regardless of throws. Players with no standing basket get nothing. (Can trigger simultaneous wins → highest total wins.)",
    category: "sasquatch",
  },

  // ---- Action -------------------------------------------------------------
  "axe-break": {
    name: "Disc Crack",
    rulesText:
      "Crack an opponent's disc! Discard the driver in front of any player. Cannot be played on a Pro-Stamped Driver.",
    category: "action",
  },
  "beavers": {
    name: "Course Hazard",
    rulesText:
      "A nasty water hazard swallows a basket! Discard one standing basket (any player) along with its throws. No points awarded.",
    category: "action",
  },
  "forest-fire": {
    name: "Course Closure",
    rulesText:
      "The course is closed for the day! Discard all standing baskets along with their throws. No points awarded.",
    category: "action",
  },
  "steal-axe": {
    name: "Bag Snatch",
    rulesText:
      "Rummage through an opponent's bag and take their driver for yourself. Discard your old driver if you had one.",
    category: "action",
  },
  "steal-equipment": {
    name: "Gear Grab",
    rulesText:
      "Swipe a piece of equipment from another player. No-doubles rule: if you steal something you already have, discard your old copy.",
    category: "action",
  },
  "switch-tags": {
    name: "Score Card Swap",
    rulesText:
      "Swap one of your completed holes with a completed hole belonging to another player. Cannot swap Speed Putt (it isn't a standard hole).",
    category: "action",
  },
  "tree-hugger": {
    name: "Park Job",
    rulesText:
      "The target parks themselves behind an obstacle and loses their next turn. Left in front of them as a reminder until consumed.",
    category: "action",
  },
  "lure-help": {
    name: "Caddy Poach",
    rulesText:
      "Lure a Help card away from another player to your side. Cannot take Blue Ox.",
    category: "action",
  },
  "babe-biscuit": {
    name: "Blue Ox Biscuit",
    rulesText:
      "Coax Blue Ox to your side of the course; or if Blue Ox is in the discard, retrieve it and put it in front of you.",
    category: "action",
  },
  "give-me-a-hand": {
    name: "Disc Assist",
    rulesText:
      "Play on yourself and choose an opponent. On their next throw you pick one of their dice before they roll; on 4/5/6 that throw scores for YOUR basket. Discard after the roll.",
    category: "action",
  },

  // ---- Reaction -----------------------------------------------------------
  "debunk": {
    name: "Rules Check",
    rulesText:
      "Counter (green). Cancels any Hooligan card. The blocked card has no effect and is discarded. Draw a replacement.",
    category: "reaction",
  },
  "northern-justice": {
    name: "Ranger Call",
    rulesText:
      "Counter (green). Stops Bag Snatch or Gear Grab; the would-be thief can't throw this turn (they may still manage their help). Draw a replacement.",
    category: "reaction",
  },
  "paperwork": {
    name: "Rules Dispute",
    rulesText:
      "Counter (green). Stops Park Job or Score Card Swap. Draw a replacement.",
    category: "reaction",
  },

  // ---- Contest ------------------------------------------------------------
  "axe-throw": {
    name: "Disc Throw-Off",
    rulesText:
      "Contest: you and a chosen opponent each roll a die (reroll ties). The higher roller gets +2 dice on their next throw (kept in front like a modifier card).",
    category: "contest",
  },
  "chainsaw-carving": {
    name: "Power Drive Contest",
    rulesText:
      "Contest: the high roller claims this card, transforming it into an 'Ace Driver' (base 5 dice). As a driver it's subject to Disc Crack, Warped Disc, Bag Snatch, etc.",
    category: "contest",
  },
  "log-rolling": {
    name: "Putting Challenge",
    rulesText:
      "Contest: the lower roller misses their putt and loses their next turn (reminder card placed in front of them).",
    category: "contest",
  },
  "speed-climb": {
    name: "Speed Putt",
    rulesText:
      "Contest: the high roller sinks an instant putt worth 2 points. It's not a standard hole and cannot be traded via Score Card Swap.",
    category: "contest",
  },

  // Synthetic disc won by Power Drive Contest
  "chainsaw": {
    name: "Ace Driver",
    rulesText:
      "An elite high-speed disc. Throws with 5 dice. Won via Power Drive Contest. Subject to all driver-affecting cards.",
    category: "equipment",
  },
};

// ---------------------------------------------------------------------------
// Tree display names — disc-golf flavour
// ---------------------------------------------------------------------------
const DG_TREE_NAMES: Record<string, string> = {
  "tree-mighty-oak":   "Basket 9 — The Colossus",
  "tree-cottonwood":   "Basket 5 — Cotton Meadow",
  "tree-american-elm": "Basket 8 — Elm Alley",
  "tree-norway-pine":  "Basket 4 — Pine Ridge",
  "tree-red-oak":      "Basket 6 — Red Oak Run",
  "tree-river-birch":  "Basket 4 — River Bend",
  "tree-silver-maple": "Basket 7 — Maple Canopy",
};

// ---------------------------------------------------------------------------
// Disc-golf theme — self-contained, no fallback to any other theme.
// ---------------------------------------------------------------------------
export const discGolfTheme: ThemeContent = {
  id: "discgolf",
  label: "Disc Golf",
  card(id: string): CardDisplay {
    return (
      DG_CARDS[id] ?? {
        name: id,
        rulesText: "",
        category: "action",
      }
    );
  },
  tree(id: string): TreeDisplay {
    const stats = treeStats(id);
    return {
      name: DG_TREE_NAMES[id] ?? id,
      chopTarget: stats.chopTarget,
      treeScore: stats.treeScore,
    };
  },
};
