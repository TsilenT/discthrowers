import type { CardCategory } from "../engine/types";

export interface CardDisplay {
  name: string;
  rulesText: string;
  category: CardCategory;
}

export interface TreeDisplay {
  name: string;
  chopTarget: number;
  treeScore: number;
}

export interface ThemeContent {
  id: string;
  label: string;
  card(id: string): CardDisplay;
  tree(id: string): TreeDisplay;
}
