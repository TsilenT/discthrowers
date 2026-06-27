/**
 * Pure-TS mechanical deck data — engine source of truth for card mechanics.
 * Display strings (name, summary) are handled by the content layer.
 * This is the engine's single source of truth for card mechanics.
 */
import type { CardCategory, CardId, TreeId } from "../types";

export interface RedCardData {
  id: CardId;
  category: CardCategory;
  subtype?: string;
  count: number;
  expansion?: boolean;
  effect: Record<string, unknown>;
  stops?: string[];
  reactableBy?: string[];
}

export interface TreeCardData {
  id: TreeId;
  count: number;
  chopTarget: number;
  treeScore: number;
}

export const RED_CARD_DATA: RedCardData[] = [
  // ---- Equipment (axes) -------------------------------------------------------
  {
    id: "carpenters-axe",
    category: "equipment",
    subtype: "axe",
    count: 5,
    effect: { baseChopDice: 3, isAxe: true },
  },
  {
    id: "chopping-axe",
    category: "equipment",
    subtype: "axe",
    count: 5,
    effect: { baseChopDice: 3, isAxe: true },
  },
  {
    id: "swedish-broad-axe",
    category: "equipment",
    subtype: "axe",
    count: 5,
    effect: { baseChopDice: 3, isAxe: true },
  },
  {
    id: "double-bladed-axe",
    category: "equipment",
    subtype: "axe",
    count: 1,
    effect: { baseChopDice: 4, isAxe: true },
  },
  {
    id: "titanium-axe",
    category: "equipment",
    subtype: "axe",
    count: 3,
    effect: { baseChopDice: 4, isAxe: true, unbreakable: true, immuneToAxeBreak: true },
  },
  {
    id: "dull-axe",
    category: "equipment",
    subtype: "axe",
    count: 5,
    effect: { baseChopDice: 2, isAxe: true },
  },
  {
    id: "boots",
    category: "equipment",
    subtype: "gear",
    count: 5,
    effect: { immuneTo: ["foot-slip"] },
  },
  {
    id: "gloves",
    category: "equipment",
    subtype: "gear",
    count: 5,
    effect: { immuneTo: ["blisters", "axe-slip"], onPlay: "discard Blisters already on you" },
  },

  // ---- Plus/Minus -------------------------------------------------------------
  {
    id: "flapjacks",
    category: "plus-minus",
    count: 3,
    effect: { diceModifier: 2, scope: "this-turn", discardIfNoChoppingRoll: true },
  },
  {
    id: "short-stack",
    category: "plus-minus",
    count: 4,
    effect: { diceModifier: 1, scope: "this-turn", discardIfNoChoppingRoll: true },
  },
  {
    id: "side-of-bacon",
    category: "plus-minus",
    expansion: true,
    count: 3,
    effect: { diceModifier: 1, scope: "next-roll", comboWith: ["flapjacks", "short-stack"], drawCardOnCombo: true },
  },
  {
    id: "axe-slip",
    category: "plus-minus",
    count: 5,
    effect: { diceModifier: -1, scope: "next-roll" },
  },
  {
    id: "foot-slip",
    category: "plus-minus",
    count: 5,
    effect: { diceModifier: -2, scope: "next-roll", blockedBy: ["boots"] },
  },
  {
    id: "winded",
    category: "plus-minus",
    count: 3,
    effect: { diceModifier: -2, scope: "next-roll" },
  },
  {
    id: "blisters",
    category: "plus-minus",
    count: 4,
    effect: { diceModifier: -1, scope: "until-gloves", blockedBy: ["gloves"] },
  },

  // ---- Help -------------------------------------------------------------------
  {
    id: "apprentice",
    category: "help",
    count: 4,
    effect: { manageHelpDice: 1, chopOn: [4, 5, 6], canBreak: false },
  },
  {
    id: "babe",
    category: "help",
    count: 1,
    effect: { manageHelpDice: 2, chopOn: [4, 5, 6], lureImmune: true },
  },
  {
    id: "long-saw-and-partner",
    category: "help",
    count: 1,
    effect: {
      manageHelpDice: 5,
      chopOn: [4, 5, 6],
      setsAxeAside: true,
      isAxe: false,
      passRightWhen: "4 or more of the rolled dice are breaks (1-2) and/or misses (3)",
      scalesWithPlusMinus: true,
    },
  },

  // ---- Sasquatch --------------------------------------------------------------
  {
    id: "sasquatch-rampage",
    category: "sasquatch",
    count: 2,
    effect: { wipesHelp: true, everyoneDiscardsHand: true, nextTurnDrawTo: 4 },
  },
  {
    id: "sasquatch-sighting",
    category: "sasquatch",
    count: 2,
    effect: { wipesHelp: true, eachOtherRollsDie: true, skipTurnOn: [1, 2, 3] },
  },
  {
    id: "that-darn-sasquatch",
    category: "sasquatch",
    count: 2,
    effect: { wipesHelp: true, discardAllEquipment: true },
  },
  {
    id: "sasquatch-mating-season",
    category: "sasquatch",
    count: 2,
    effect: { wipesHelp: true, targetSkipsTurn: true, optionalStealStandingTree: true, treeComesWithChops: true },
  },

  // ---- Action -----------------------------------------------------------------
  {
    id: "paul-bunyan",
    category: "action",
    count: 1,
    effect: { fellAndScoreAllStandingTrees: true },
  },
  {
    id: "axe-break",
    category: "action",
    count: 4,
    effect: { discardTargetAxe: true, blockedBy: ["titanium-axe"] },
  },
  {
    id: "beavers",
    category: "action",
    count: 2,
    effect: { discardOneStandingTree: true, withChops: true, scores: false },
  },
  {
    id: "forest-fire",
    category: "action",
    count: 1,
    effect: { discardAllStandingTrees: true, withChops: true, scores: false },
  },
  {
    id: "steal-axe",
    category: "action",
    count: 3,
    reactableBy: ["northern-justice"],
    effect: { takeTargetAxe: true, discardOwnOldAxe: true },
  },
  {
    id: "steal-equipment",
    category: "action",
    count: 3,
    reactableBy: ["northern-justice"],
    effect: { takeTargetEquipment: true, noDoublesDiscard: true },
  },
  {
    id: "switch-tags",
    category: "action",
    count: 3,
    reactableBy: ["paperwork"],
    effect: { swapScoredTree: true, excludes: ["speed-climb"] },
  },
  {
    id: "tree-hugger",
    category: "action",
    count: 4,
    reactableBy: ["paperwork"],
    effect: { targetSkipsNextTurn: true },
  },
  {
    id: "lure-help",
    category: "action",
    count: 5,
    effect: { moveHelpCardToSelf: true, cannotTake: ["babe"] },
  },
  {
    id: "babe-biscuit",
    category: "action",
    count: 4,
    effect: { moveBabeToSelf: true, fromDiscardAllowed: true },
  },
  {
    id: "give-me-a-hand",
    category: "action",
    count: 2,
    effect: {
      hijackOneOpponentDie: true,
      appliesTo: "opponent's next chopping roll",
      chopOn: [4, 5, 6],
      chopsScoreFor: "self",
      canContributeToAxeBreak: true,
      discardAfterRoll: true,
    },
  },

  // ---- Reaction ---------------------------------------------------------------
  {
    id: "debunk",
    category: "reaction",
    count: 3,
    stops: ["sasquatch"],
    effect: { outOfTurn: true, drawReplacement: true },
  },
  {
    id: "northern-justice",
    category: "reaction",
    count: 2,
    stops: ["steal-axe", "steal-equipment"],
    effect: { outOfTurn: true, drawReplacement: true, thiefCannotChopThisTurn: true, thiefCanStillManageHelp: true },
  },
  {
    id: "paperwork",
    category: "reaction",
    count: 5,
    stops: ["tree-hugger", "switch-tags"],
    effect: { outOfTurn: true, drawReplacement: true },
  },

  // ---- Contest ----------------------------------------------------------------
  {
    id: "axe-throw",
    category: "contest",
    count: 2,
    effect: { contest: true, winnerDiceModifier: 2, scope: "next-roll", appliesAs: "plus-minus" },
  },
  {
    id: "chainsaw-carving",
    category: "contest",
    count: 2,
    effect: { contest: true, winnerGainsAxe: { id: "chainsaw", baseChopDice: 5, isAxe: true } },
  },
  {
    id: "log-rolling",
    category: "contest",
    count: 2,
    effect: { contest: true, loserSkipsNextTurn: true },
  },
  {
    id: "speed-climb",
    category: "contest",
    count: 2,
    effect: { contest: true, winnerVictoryPoints: 2, isTree: false, switchTagsImmune: true },
  },
];

export const TREE_CARD_DATA: TreeCardData[] = [
  { id: "tree-mighty-oak",   count: 1, chopTarget: 9,  treeScore: 12 },
  { id: "tree-cottonwood",   count: 7, chopTarget: 5,  treeScore: 6  },
  { id: "tree-american-elm", count: 2, chopTarget: 8,  treeScore: 8  },
  { id: "tree-norway-pine",  count: 8, chopTarget: 4,  treeScore: 4  },
  { id: "tree-red-oak",      count: 6, chopTarget: 6,  treeScore: 7  },
  { id: "tree-river-birch",  count: 8, chopTarget: 4,  treeScore: 5  },
  { id: "tree-silver-maple", count: 3, chopTarget: 7,  treeScore: 8  },
];
