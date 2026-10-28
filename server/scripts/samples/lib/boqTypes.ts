/** A priced line in a bill. Its amount is quantity x rate unless `typedAmount` plants an arithmetic error. */
export interface BoqItem {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  /** A typed amount that differs from quantity x rate: a planted arithmetic error. */
  typedAmount?: number;
}

export interface BoqSection {
  code: string;
  title: string;
  items: BoqItem[];
  /** The sub-total formula stops one row short and misses the last item: a planted error. */
  subtotalMissesLastItem?: boolean;
}

/** One bill, written to its own sheet. */
export interface BoqBill {
  number: number;
  sheet: string;
  title: string;
  sections: BoqSection[];
}

export interface BoqRevision {
  fileName: string;
  revision: number;
  /** YYYY-MM-DD. */
  issueDate: string;
  currency: string;
  bills: BoqBill[];
}

/** What a later revision changes, by item code. */
export interface BoqChanges {
  fileName: string;
  revision: number;
  issueDate: string;
  quantities: Record<string, number>;
  rates: Record<string, number>;
  added: { after: string; item: BoqItem }[];
  removed: string[];
  /** Items whose typed amount is replaced by the quantity x rate formula. */
  corrected: string[];
}
